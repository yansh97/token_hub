use axum::{body::Bytes, http::StatusCode};
use serde_json::{json, Map, Number, Value};
use std::time::{SystemTime, UNIX_EPOCH};

use super::sequence::ResponsesEventSequence;

const UNKNOWN_MODEL: &str = "unknown";

#[derive(Default)]
pub(crate) struct StreamNormalization {
    pub(crate) sequence_number: Option<u64>,
    pub(crate) added_created_at: bool,
    pub(crate) added_model: bool,
    pub(crate) repaired_response_shape: bool,
}

impl StreamNormalization {
    pub(crate) fn changed(&self) -> bool {
        self.sequence_number.is_some()
            || self.added_created_at
            || self.added_model
            || self.repaired_response_shape
    }
}

pub(crate) struct HttpErrorNormalization {
    pub(crate) body: Bytes,
    pub(crate) changed: bool,
}

/// Repairs only the required OpenAI error envelope fields and preserves upstream details.
pub(crate) fn normalize_http_error(status: StatusCode, body: &Bytes) -> HttpErrorNormalization {
    let fallback = error_fallback(status);
    let parsed = serde_json::from_slice::<Value>(body).ok();
    let message = error_message(parsed.as_ref(), body, status);
    let mut root = parsed
        .as_ref()
        .cloned()
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    let mut error = root
        .remove("error")
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    insert_non_empty_string(&mut error, "message", &message);
    insert_non_empty_string(&mut error, "type", fallback);
    insert_non_empty_string(&mut error, "code", fallback);
    error.entry("param".to_string()).or_insert(Value::Null);
    root.insert("error".to_string(), Value::Object(error));

    let normalized = Value::Object(root);
    let changed = parsed.as_ref() != Some(&normalized);
    let body = if changed {
        serde_json::to_vec(&normalized)
            .map(Bytes::from)
            .unwrap_or_else(|_| body.clone())
    } else {
        body.clone()
    };
    HttpErrorNormalization { body, changed }
}

/// Makes a terminal Responses failure consumable by strict clients without touching healthy events.
pub(crate) fn normalize_stream_event(
    value: &mut Value,
    sequence: &mut ResponsesEventSequence,
    model: Option<&str>,
) -> StreamNormalization {
    let sequence_number = sequence.ensure_error_event(value);
    if value.get("type").and_then(Value::as_str) != Some("response.failed") {
        return StreamNormalization {
            sequence_number,
            ..Default::default()
        };
    }

    let mut repaired_response_shape = false;
    if !value.get("response").is_some_and(Value::is_object) {
        value["response"] = Value::Object(Map::new());
        repaired_response_shape = true;
    }
    let response = value
        .get_mut("response")
        .and_then(Value::as_object_mut)
        .expect("response.failed response was repaired to an object");

    repaired_response_shape |=
        insert_non_empty_string(response, "id", &format!("resp_proxy_{}", now_unix_millis()));
    repaired_response_shape |= insert_non_empty_string(response, "object", "response");
    repaired_response_shape |= insert_non_empty_string(response, "status", "failed");
    if !response.get("output").is_some_and(Value::is_array) {
        response.insert("output".to_string(), Value::Array(Vec::new()));
        repaired_response_shape = true;
    }

    let added_created_at = !response.get("created_at").is_some_and(Value::is_number);
    if added_created_at {
        response.insert(
            "created_at".to_string(),
            Value::Number(Number::from(now_unix_seconds())),
        );
    }

    let resolved_model = model
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(UNKNOWN_MODEL);
    let added_model = insert_non_empty_string(response, "model", resolved_model);
    repaired_response_shape |= normalize_response_error(response);

    StreamNormalization {
        sequence_number,
        added_created_at,
        added_model,
        repaired_response_shape,
    }
}

pub(crate) fn failed_event(message: &str, model: Option<&str>, sequence_number: u64) -> Value {
    let mut value = json!({
        "type": "response.failed",
        "sequence_number": sequence_number,
        "response": {
            "error": {
                "code": "server_error",
                "message": message,
            }
        }
    });
    // Keep synthetic and normalized upstream failures on the same wire contract.
    let mut sequence = ResponsesEventSequence::default();
    let _ = normalize_stream_event(&mut value, &mut sequence, model);
    value
}

fn normalize_response_error(response: &mut Map<String, Value>) -> bool {
    let mut changed = false;
    if !response.get("error").is_some_and(Value::is_object) {
        response.insert("error".to_string(), Value::Object(Map::new()));
        changed = true;
    }
    let error = response
        .get_mut("error")
        .and_then(Value::as_object_mut)
        .expect("response.failed error was repaired to an object");
    changed |= insert_non_empty_string(error, "code", "server_error");
    changed |= insert_non_empty_string(error, "message", "Upstream request failed");
    changed
}

fn insert_non_empty_string(target: &mut Map<String, Value>, key: &str, fallback: &str) -> bool {
    if target
        .get(key)
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty())
    {
        return false;
    }
    target.insert(key.to_string(), Value::String(fallback.to_string()));
    true
}

fn error_fallback(status: StatusCode) -> &'static str {
    if status.is_server_error() {
        "server_error"
    } else {
        "invalid_request_error"
    }
}

fn error_message(parsed: Option<&Value>, body: &Bytes, status: StatusCode) -> String {
    parsed
        .and_then(|value| value.get("error"))
        .and_then(|error| error.get("message").or(Some(error)))
        .or_else(|| parsed.and_then(|value| value.get("message")))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            let text = String::from_utf8_lossy(body);
            let text = text.trim();
            (!text.is_empty()).then(|| text.to_string())
        })
        .unwrap_or_else(|| {
            status
                .canonical_reason()
                .unwrap_or("Upstream request failed")
                .to_string()
        })
}

fn now_unix_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn now_unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}
