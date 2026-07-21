use axum::http::header::{HeaderName, HeaderValue};
use axum::http::HeaderMap;

use token_proxy_account_codex::{
    is_official_originator, official_originator_from_user_agent, supported_official_user_agent,
    DEFAULT_ORIGINATOR, USER_AGENT,
};

const HEADER_USER_AGENT_NAME: HeaderName = HeaderName::from_static("user-agent");
const HEADER_ACCEPT_NAME: HeaderName = HeaderName::from_static("accept");
const HEADER_OPENAI_BETA_NAME: HeaderName = HeaderName::from_static("openai-beta");
const HEADER_LEGACY_SESSION_ID_NAME: HeaderName = HeaderName::from_static("session_id");
const HEADER_CONNECTION_NAME: HeaderName = HeaderName::from_static("connection");
const HEADER_ORIGINATOR_NAME: HeaderName = HeaderName::from_static("originator");
const HEADER_SESSION_ID_NAME: HeaderName = HeaderName::from_static("session-id");
const HEADER_THREAD_ID_NAME: HeaderName = HeaderName::from_static("thread-id");
const HEADER_CLIENT_REQUEST_ID_NAME: HeaderName = HeaderName::from_static("x-client-request-id");

pub(crate) fn apply_codex_headers(headers: &mut HeaderMap, inbound: &HeaderMap) {
    headers.remove(&HEADER_OPENAI_BETA_NAME);
    headers.remove(&HEADER_LEGACY_SESSION_ID_NAME);
    headers.remove(&HEADER_CONNECTION_NAME);

    let fallback_session_id = generate_session_id();
    let session_id = copy_inbound_or_generate(
        headers,
        inbound,
        &HEADER_SESSION_ID_NAME,
        &fallback_session_id,
    );
    let thread_id = copy_inbound_or_generate(headers, inbound, &HEADER_THREAD_ID_NAME, &session_id);
    copy_inbound_or_generate(headers, inbound, &HEADER_CLIENT_REQUEST_ID_NAME, &thread_id);

    apply_codex_identity_headers(headers, inbound);
    force_header(headers, &HEADER_ACCEPT_NAME, "text/event-stream");
}

fn force_header(headers: &mut HeaderMap, name: &HeaderName, value: &str) {
    if let Ok(value) = HeaderValue::from_str(value) {
        headers.insert(name.clone(), value);
    }
}

fn copy_inbound_or_generate(
    headers: &mut HeaderMap,
    inbound: &HeaderMap,
    name: &HeaderName,
    fallback: &str,
) -> String {
    if let Some(value) = inbound.get(name).and_then(valid_header_value) {
        if let Ok(header_value) = HeaderValue::from_str(value) {
            headers.insert(name.clone(), header_value);
            return value.to_string();
        }
    }
    if let Some(value) = headers.get(name).and_then(valid_header_value) {
        return value.to_string();
    }
    force_header(headers, name, fallback);
    fallback.to_string()
}

fn valid_header_value(value: &HeaderValue) -> Option<&str> {
    value
        .to_str()
        .ok()
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn apply_codex_identity_headers(headers: &mut HeaderMap, inbound: &HeaderMap) {
    let inbound_user_agent = inbound
        .get(&HEADER_USER_AGENT_NAME)
        .and_then(valid_header_value);
    let user_agent = if is_native_codex_request(inbound) {
        inbound_user_agent
            .and_then(supported_official_user_agent)
            .unwrap_or(USER_AGENT)
    } else {
        USER_AGENT
    };
    if inbound_user_agent.is_some_and(|value| value != user_agent) {
        tracing::debug!(
            inbound_user_agent,
            user_agent,
            "replaced unsupported Codex client identity"
        );
    }
    force_header(headers, &HEADER_USER_AGENT_NAME, user_agent);

    let originator = official_originator_from_user_agent(user_agent).unwrap_or(DEFAULT_ORIGINATOR);
    force_header(headers, &HEADER_ORIGINATOR_NAME, originator);
}

pub(crate) fn is_native_codex_request(inbound: &HeaderMap) -> bool {
    inbound
        .get(&HEADER_ORIGINATOR_NAME)
        .and_then(valid_header_value)
        .is_some_and(is_official_originator)
        || inbound
            .get(&HEADER_USER_AGENT_NAME)
            .and_then(valid_header_value)
            .and_then(official_originator_from_user_agent)
            .is_some()
}

fn generate_session_id() -> String {
    crate::proxy::kiro::utils::random_uuid()
}
