use serde_json::Value;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum XaiForbiddenScope {
    RequestContentPolicy,
    AccountAccess,
    Unknown,
}

pub fn classify_http_forbidden(status: u16, body: &[u8]) -> Option<XaiForbiddenScope> {
    (status == 403).then(|| classify_payload(body))
}

pub fn classify_payload(body: &[u8]) -> XaiForbiddenScope {
    if body.is_empty() {
        return XaiForbiddenScope::Unknown;
    }
    let text = String::from_utf8_lossy(body).to_ascii_lowercase();
    if account_access_message(&text) {
        return XaiForbiddenScope::AccountAccess;
    }
    if let Ok(value) = serde_json::from_slice::<Value>(body) {
        if structured_marker(&value, is_account_access_code) {
            return XaiForbiddenScope::AccountAccess;
        }
        if structured_marker(&value, is_content_policy_code) {
            return XaiForbiddenScope::RequestContentPolicy;
        }
    }
    if content_policy_message(&text) {
        XaiForbiddenScope::RequestContentPolicy
    } else {
        XaiForbiddenScope::Unknown
    }
}

pub fn payload_error_code(body: &[u8]) -> Option<String> {
    let value = serde_json::from_slice::<Value>(body).ok()?;
    structured_error_code(&value)
}

fn structured_error_code(value: &Value) -> Option<String> {
    match value {
        Value::Object(object) => {
            for (key, child) in object {
                let key = normalize_marker(key);
                if matches!(key.as_str(), "code" | "error_code") {
                    if let Some(code) = child.as_str().and_then(safe_error_code) {
                        return Some(code.to_string());
                    }
                }
                if let Some(code) = structured_error_code(child) {
                    return Some(code);
                }
            }
            None
        }
        Value::Array(items) => items.iter().find_map(structured_error_code),
        _ => None,
    }
}

fn safe_error_code(value: &str) -> Option<&str> {
    let value = value.trim();
    (!value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b':' | b'.')))
    .then_some(value)
}

fn structured_marker(value: &Value, matches: fn(&str) -> bool) -> bool {
    match value {
        Value::Object(object) => object.iter().any(|(key, child)| {
            let key = normalize_marker(key);
            matches!(
                key.as_str(),
                "code" | "error_code" | "type" | "category" | "reason"
            ) && child.as_str().is_some_and(matches)
                || structured_marker(child, matches)
        }),
        Value::Array(items) => items.iter().any(|item| structured_marker(item, matches)),
        _ => false,
    }
}

fn normalize_marker(value: &str) -> String {
    value.trim().to_ascii_lowercase().replace(['-', ' '], "_")
}

fn is_content_policy_code(value: &str) -> bool {
    matches!(
        normalize_marker(value).as_str(),
        "content_filter"
            | "content_policy"
            | "content_policy_violation"
            | "content_moderation"
            | "cyber_policy"
            | "new_sensitive"
    )
}

fn is_account_access_code(value: &str) -> bool {
    matches!(
        normalize_marker(value).as_str(),
        "account_suspended"
            | "account_disabled"
            | "user_suspended"
            | "user_disabled"
            | "subscription_required"
            | "entitlement_required"
            | "not_entitled"
            | "plan_required"
            | "permission_denied"
    )
}

fn account_access_message(text: &str) -> bool {
    [
        "account suspended",
        "account has been suspended",
        "account disabled",
        "account has been disabled",
        "user suspended",
        "user has been suspended",
        "subscription required",
        "entitlement required",
        "not entitled",
    ]
    .iter()
    .any(|phrase| text.contains(phrase))
}

fn content_policy_message(text: &str) -> bool {
    [
        "the moderation feature is not available",
        "image is sensitive",
        "text is sensitive",
        "prohibited content",
        "forbidden content",
        "content policy violation",
        "content policy rejection",
        "content policy rejected",
        "content moderation rejection",
        "content moderation rejected",
        "content moderation blocked",
        "request blocked by content moderation",
        "request rejected by content moderation",
        "request blocked by policy",
        "request rejected by policy",
        "request violates policy",
        "prompt violates content policy",
        "prompt violates policy",
        "input violates content policy",
        "input violates policy",
    ]
    .iter()
    .any(|phrase| text.contains(phrase))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_request_account_and_unknown_forbidden() {
        let cases = [
            (
                br#"{"error":{"code":"new_sensitive","message":"image is sensitive"}}"#.as_slice(),
                XaiForbiddenScope::RequestContentPolicy,
            ),
            (
                br#"{"error":{"code":"account_suspended","reason":"content_policy","message":"account suspended due to policy violation"}}"#.as_slice(),
                XaiForbiddenScope::AccountAccess,
            ),
            (
                br#"{"error":{"message":"subscription required"}}"#.as_slice(),
                XaiForbiddenScope::AccountAccess,
            ),
            (
                br#"{"error":{"code":"policy_violation","message":"policy violation"}}"#.as_slice(),
                XaiForbiddenScope::Unknown,
            ),
            (
                br#"{"error":{"code":"policy_violation","message":"request blocked by policy"}}"#.as_slice(),
                XaiForbiddenScope::RequestContentPolicy,
            ),
        ];
        for (body, expected) in cases {
            assert_eq!(classify_payload(body), expected);
            assert_eq!(classify_http_forbidden(403, body), Some(expected));
        }
        assert_eq!(classify_http_forbidden(400, cases[0].0), None);
        assert_eq!(
            payload_error_code(cases[0].0).as_deref(),
            Some("new_sensitive")
        );
        assert_eq!(
            payload_error_code(br#"{"error":{"code":"unsafe prompt text"}}"#),
            None
        );
    }
}
