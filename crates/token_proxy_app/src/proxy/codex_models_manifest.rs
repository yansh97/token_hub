use axum::http::{header::ACCEPT, HeaderMap, HeaderName, HeaderValue, Method};
use url::form_urlencoded;

use token_proxy_account_codex::enforce_minimum_client_version;

const OPENAI_MODELS_PATH: &str = "/v1/models";
const CLIENT_VERSION_QUERY: &str = "client_version";
const VERSION_HEADER: HeaderName = HeaderName::from_static("version");

pub(crate) const CODEX_MODELS_MANIFEST_PATH: &str = "/models";

pub(crate) fn is_request(method: &Method, path: &str, query: Option<&str>) -> bool {
    method == Method::GET && path == OPENAI_MODELS_PATH && client_version(query).is_some()
}

pub(crate) fn apply_upstream_headers(
    provider: &str,
    inbound_path: &str,
    upstream_path_with_query: &str,
    headers: &mut HeaderMap,
) {
    if provider != "codex" || inbound_path != OPENAI_MODELS_PATH {
        return;
    }
    let query = upstream_path_with_query
        .split_once('?')
        .map(|(_, query)| query);
    let Some(client_version) = client_version(query) else {
        return;
    };

    // Codex 的 models manifest 是普通 JSON，不使用 Responses 的 SSE Accept 合同。
    headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
    let supported_version = enforce_minimum_client_version(&client_version);
    if supported_version != client_version.trim() {
        tracing::debug!(
            client_version,
            supported_version,
            "raised Codex models manifest client version"
        );
    }
    match HeaderValue::from_str(supported_version) {
        Ok(value) => {
            headers.insert(VERSION_HEADER, value);
            tracing::debug!(
                client_version = supported_version,
                "prepared Codex models manifest headers"
            );
        }
        Err(_) => {
            tracing::warn!("ignored invalid Codex models client_version header value");
        }
    }
}

fn client_version(query: Option<&str>) -> Option<String> {
    form_urlencoded::parse(query?.as_bytes()).find_map(|(key, value)| {
        if key != CLIENT_VERSION_QUERY || value.trim().is_empty() {
            return None;
        }
        Some(value.into_owned())
    })
}
