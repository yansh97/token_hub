use serde_json::{Map, Value};
use std::collections::{HashMap, HashSet};

use super::RestoredToolName;

const PRESERVED_IMAGE_NAMESPACE: &str = "image_gen";

pub(super) fn collect_tool_identities(value: &Value) -> Vec<(String, RestoredToolName)> {
    let mut identities = Vec::new();
    let Some(tools) = value.as_array() else {
        return identities;
    };
    for tool in tools {
        let tool_type = tool.get("type").and_then(Value::as_str);
        if tool_type == Some("function") {
            let name = tool
                .get("function")
                .and_then(|function| function.get("name"))
                .and_then(Value::as_str)
                .or_else(|| tool.get("name").and_then(Value::as_str))
                .map(str::trim)
                .filter(|name| !name.is_empty());
            if let Some(name) = name {
                identities.push((
                    name.to_string(),
                    RestoredToolName {
                        name: name.to_string(),
                        namespace: None,
                    },
                ));
            }
            continue;
        }
        if tool_type != Some("namespace") {
            continue;
        }
        let Some(namespace) = namespace_name(tool) else {
            continue;
        };
        for child in namespace_children(tool) {
            if child.get("type").and_then(Value::as_str) != Some("function") {
                continue;
            }
            let Some(name) = child_name(child) else {
                continue;
            };
            identities.push((
                flatten_tool_name(namespace, name),
                RestoredToolName {
                    name: name.to_string(),
                    namespace: Some(namespace.to_string()),
                },
            ));
        }
    }
    identities
}

/// Codex does not accept arbitrary Responses namespaces, so flatten them before
/// tool-name shortening while preserving its built-in image namespace verbatim.
pub(super) fn flatten_responses_namespaces(object: &mut Map<String, Value>) -> Result<(), String> {
    let Some(tools) = object.get("tools").and_then(Value::as_array) else {
        return Ok(());
    };
    let top_level_names = collect_top_level_names(tools);
    let namespace_names = collect_namespace_names(tools, &top_level_names)?;
    if namespace_names.is_empty() {
        return Ok(());
    }

    object.insert(
        "tools".to_string(),
        Value::Array(flatten_tools(tools, &namespace_names)),
    );
    if let Some(input) = object.get_mut("input") {
        rewrite_function_calls(input, &namespace_names);
    }
    if let Some(tool_choice) = object.get_mut("tool_choice") {
        if tool_choice.get("type").and_then(Value::as_str) == Some("namespace")
            && tool_choice.get("name").and_then(Value::as_str) != Some(PRESERVED_IMAGE_NAMESPACE)
        {
            *tool_choice = Value::String("auto".to_string());
        } else {
            rewrite_function_call(tool_choice, &namespace_names);
        }
    }
    tracing::debug!(
        namespace_tool_count = namespace_names.len(),
        "flattened Responses namespace tools for Codex upstream"
    );
    Ok(())
}

fn collect_top_level_names(tools: &[Value]) -> HashSet<String> {
    tools
        .iter()
        .filter(|tool| {
            matches!(
                tool.get("type").and_then(Value::as_str),
                Some("function" | "custom")
            )
        })
        .filter_map(|tool| tool.get("name").and_then(Value::as_str))
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .collect()
}

fn collect_namespace_names(
    tools: &[Value],
    top_level_names: &HashSet<String>,
) -> Result<HashMap<String, (String, String)>, String> {
    let mut names = HashMap::new();
    for tool in tools {
        let Some(namespace) = namespace_name(tool) else {
            continue;
        };
        for child in namespace_children(tool) {
            if child.get("type").and_then(Value::as_str) != Some("function") {
                continue;
            }
            let Some(name) = child_name(child) else {
                continue;
            };
            let flat_name = flatten_tool_name(namespace, name);
            if top_level_names.contains(&flat_name) {
                return Err(format!(
                    "Namespace tool {namespace}/{name} conflicts with top-level tool {flat_name}."
                ));
            }
            let identity = (namespace.to_string(), name.to_string());
            if names
                .get(&flat_name)
                .is_some_and(|existing| existing != &identity)
            {
                return Err(format!(
                    "Namespace tool {namespace}/{name} conflicts with another tool flattened as {flat_name}."
                ));
            }
            names.insert(flat_name, identity);
        }
    }
    Ok(names)
}

fn flatten_tools(tools: &[Value], names: &HashMap<String, (String, String)>) -> Vec<Value> {
    let mut flattened = Vec::with_capacity(tools.len() + names.len());
    let mut seen = HashSet::new();
    for tool in tools {
        if tool.get("type").and_then(Value::as_str) != Some("namespace")
            || tool.get("name").and_then(Value::as_str) == Some(PRESERVED_IMAGE_NAMESPACE)
        {
            flattened.push(tool.clone());
            continue;
        }
        let Some(namespace) = tool.get("name").and_then(Value::as_str).map(str::trim) else {
            continue;
        };
        for child in namespace_children(tool) {
            if child.get("type").and_then(Value::as_str) != Some("function") {
                continue;
            }
            let Some(name) = child_name(child) else {
                continue;
            };
            let flat_name = flatten_tool_name(namespace, name);
            if !names.contains_key(&flat_name) || !seen.insert(flat_name.clone()) {
                continue;
            }
            let mut child = child.as_object().cloned().unwrap_or_default();
            child.insert("name".to_string(), Value::String(flat_name));
            flattened.push(Value::Object(child));
        }
    }
    flattened
}

fn namespace_name(tool: &Value) -> Option<&str> {
    if tool.get("type").and_then(Value::as_str) != Some("namespace") {
        return None;
    }
    tool.get("name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|name| !name.is_empty() && *name != PRESERVED_IMAGE_NAMESPACE)
}

fn child_name(child: &Value) -> Option<&str> {
    child
        .get("name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|name| !name.is_empty())
}

fn namespace_children(tool: &Value) -> &[Value] {
    tool.get("tools")
        .and_then(Value::as_array)
        .or_else(|| tool.get("children").and_then(Value::as_array))
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

fn flatten_tool_name(namespace: &str, name: &str) -> String {
    format!("{}__{}", namespace.trim(), name.trim())
}

fn rewrite_function_calls(value: &mut Value, names: &HashMap<String, (String, String)>) {
    match value {
        Value::Array(items) => {
            for item in items {
                rewrite_function_calls(item, names);
            }
        }
        Value::Object(object) => {
            if object.get("type").and_then(Value::as_str) == Some("function_call") {
                rewrite_function_call_object(object, names);
            }
            for child in object.values_mut() {
                rewrite_function_calls(child, names);
            }
        }
        _ => {}
    }
}

fn rewrite_function_call(value: &mut Value, names: &HashMap<String, (String, String)>) {
    if let Some(object) = value.as_object_mut() {
        rewrite_function_call_object(object, names);
    }
}

fn rewrite_function_call_object(
    object: &mut Map<String, Value>,
    names: &HashMap<String, (String, String)>,
) {
    let Some(namespace) = object
        .get("namespace")
        .and_then(Value::as_str)
        .map(str::trim)
    else {
        return;
    };
    let Some(name) = object.get("name").and_then(Value::as_str).map(str::trim) else {
        return;
    };
    let flat_name = flatten_tool_name(namespace, name);
    if names.get(&flat_name) != Some(&(namespace.to_string(), name.to_string())) {
        return;
    }
    object.insert("name".to_string(), Value::String(flat_name));
    object.remove("namespace");
}
