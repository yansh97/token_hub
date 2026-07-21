use axum::http::{
    header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE, USER_AGENT},
    HeaderMap, HeaderName, HeaderValue, StatusCode,
};
use serde_json::Value;

use super::super::http::RequestAuth;
use super::super::{
    codex_models_manifest,
    config::{ProviderUpstreams, UpstreamRuntime},
    cooldown_scope::CooldownScope,
    gemini, http,
    request_body::ReplayableBody,
    ProxyState, RequestMeta,
};
use super::{request, AttemptOutcome, PreparedUpstreamRequest, ResolvedUpstreamAuth};

pub(super) async fn prepare_upstream_request(
    state: &ProxyState,
    provider: &str,
    upstream: &UpstreamRuntime,
    inbound_path: &str,
    upstream_path_with_query: &str,
    headers: &HeaderMap,
    meta: &RequestMeta,
    request_auth: &RequestAuth,
    cooldown_scope: &CooldownScope,
) -> Result<PreparedUpstreamRequest, AttemptOutcome> {
    let body = ReplayableBody::from_bytes(Default::default());
    prepare_upstream_request_with_body(
        state,
        provider,
        upstream,
        inbound_path,
        upstream_path_with_query,
        headers,
        &body,
        meta,
        request_auth,
        cooldown_scope,
    )
    .await
}

pub(super) async fn prepare_upstream_request_with_body(
    state: &ProxyState,
    provider: &str,
    upstream: &UpstreamRuntime,
    inbound_path: &str,
    upstream_path_with_query: &str,
    headers: &HeaderMap,
    body: &ReplayableBody,
    meta: &RequestMeta,
    request_auth: &RequestAuth,
    cooldown_scope: &CooldownScope,
) -> Result<PreparedUpstreamRequest, AttemptOutcome> {
    let mapped_meta = build_mapped_meta(meta, upstream);
    let upstream_path_with_query =
        resolve_upstream_path_with_query(provider, upstream_path_with_query, &mapped_meta);
    let upstream_url = upstream.upstream_url(&upstream_path_with_query);
    let resolved = resolve_upstream_auth(
        state,
        provider,
        upstream,
        request_auth,
        cooldown_scope,
        &upstream_path_with_query,
        &upstream_url,
    )
    .await?;
    let ResolvedUpstreamAuth {
        upstream_url,
        auth,
        extra_headers,
        proxy_url,
        selected_account_id,
        codex_openai_device_id,
    } = resolved;
    let mut request_headers = request::build_request_headers(
        provider,
        inbound_path,
        headers,
        auth,
        extra_headers.as_ref(),
        upstream.header_overrides.as_deref(),
    );
    if provider == "xai" {
        enforce_xai_request_headers(
            &upstream_path_with_query,
            body,
            mapped_meta.stream,
            extra_headers.as_ref(),
            &mut request_headers,
        );
    }
    codex_models_manifest::apply_upstream_headers(
        provider,
        inbound_path,
        &upstream_path_with_query,
        &mut request_headers,
    );
    Ok(PreparedUpstreamRequest {
        upstream_path_with_query,
        upstream_url,
        request_headers,
        proxy_url,
        selected_account_id,
        codex_openai_device_id,
        meta: mapped_meta,
    })
}

async fn resolve_upstream_auth(
    state: &ProxyState,
    provider: &str,
    upstream: &UpstreamRuntime,
    request_auth: &RequestAuth,
    cooldown_scope: &CooldownScope,
    upstream_path_with_query: &str,
    upstream_url: &str,
) -> Result<ResolvedUpstreamAuth, AttemptOutcome> {
    if provider == "gemini" {
        let (upstream_url, auth) = request::resolve_gemini_upstream(
            upstream,
            request_auth,
            upstream_path_with_query,
            upstream_url,
        )?;
        return Ok(ResolvedUpstreamAuth {
            upstream_url,
            auth,
            extra_headers: None,
            proxy_url: upstream.proxy_url.clone(),
            selected_account_id: None,
            codex_openai_device_id: None,
        });
    }
    if provider == "kiro" {
        return resolve_kiro_upstream(state, upstream, upstream_url).await;
    }
    if provider == "codex" {
        return resolve_codex_upstream(state, upstream, upstream_url, cooldown_scope).await;
    }
    if provider == "xai" {
        return resolve_xai_upstream(state, upstream, upstream_path_with_query, cooldown_scope)
            .await;
    }
    let auth = match http::resolve_upstream_auth(provider, upstream, request_auth) {
        Ok(Some(auth)) => auth,
        Ok(None) => return Err(AttemptOutcome::SkippedAuth),
        Err(response) => return Err(AttemptOutcome::Fatal(response)),
    };
    Ok(ResolvedUpstreamAuth {
        upstream_url: upstream_url.to_string(),
        auth,
        extra_headers: None,
        proxy_url: upstream.proxy_url.clone(),
        selected_account_id: None,
        codex_openai_device_id: None,
    })
}

async fn resolve_kiro_upstream(
    state: &ProxyState,
    upstream: &UpstreamRuntime,
    upstream_url: &str,
) -> Result<ResolvedUpstreamAuth, AttemptOutcome> {
    let ordered_account_ids = if upstream
        .kiro_account_id
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| !value.is_empty())
    {
        None
    } else {
        Some(ordered_runtime_account_ids(state, "kiro", &CooldownScope::Global).await)
    };
    let (selected_account_id, record) = state
        .kiro_accounts
        .resolve_account_record_with_order(
            upstream.kiro_account_id.as_deref(),
            ordered_account_ids.as_deref(),
        )
        .await
        .map_err(|err| {
            AttemptOutcome::Fatal(http::error_response(StatusCode::UNAUTHORIZED, err))
        })?;
    let global_proxy_url = state.kiro_accounts.app_proxy_url().await;
    let proxy_url = record
        .proxy_url
        .clone()
        .or_else(|| upstream.proxy_url.clone())
        .or(global_proxy_url);
    let value = http::bearer_header(&record.access_token).ok_or_else(|| {
        AttemptOutcome::Fatal(http::error_response(
            StatusCode::UNAUTHORIZED,
            "Upstream access token contains invalid characters.",
        ))
    })?;
    Ok(ResolvedUpstreamAuth {
        upstream_url: upstream_url.to_string(),
        auth: http::UpstreamAuthHeader {
            name: AUTHORIZATION,
            value,
        },
        extra_headers: None,
        proxy_url,
        selected_account_id: Some(selected_account_id),
        codex_openai_device_id: None,
    })
}

async fn resolve_codex_upstream(
    state: &ProxyState,
    upstream: &UpstreamRuntime,
    upstream_url: &str,
    cooldown_scope: &CooldownScope,
) -> Result<ResolvedUpstreamAuth, AttemptOutcome> {
    let has_pinned_account = upstream
        .codex_account_id
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| !value.is_empty());
    let ordered_account_ids = if has_pinned_account {
        None
    } else {
        Some(ordered_runtime_account_ids(state, "codex", cooldown_scope).await)
    };
    let (selected_account_id, record) = state
        .codex_accounts
        .resolve_account_record_with_order(
            upstream.codex_account_id.as_deref(),
            ordered_account_ids.as_deref(),
        )
        .await
        .map_err(|err| account_resolution_outcome("Codex", has_pinned_account, err))?;
    let global_proxy_url = state.codex_accounts.app_proxy_url().await;
    let proxy_url = record
        .proxy_url
        .clone()
        .or_else(|| upstream.proxy_url.clone())
        .or(global_proxy_url);
    let value = http::bearer_header(&record.access_token).ok_or_else(|| {
        AttemptOutcome::Fatal(http::error_response(
            StatusCode::UNAUTHORIZED,
            "Upstream access token contains invalid characters.",
        ))
    })?;
    let mut extra_headers = HeaderMap::new();
    if let Some(account_id) = record.account_id.as_deref() {
        if let Ok(value) = axum::http::HeaderValue::from_str(account_id) {
            extra_headers.insert(
                axum::http::HeaderName::from_static("chatgpt-account-id"),
                value,
            );
        }
    }
    let extra_headers = if extra_headers.is_empty() {
        None
    } else {
        Some(extra_headers)
    };
    Ok(ResolvedUpstreamAuth {
        upstream_url: upstream_url.to_string(),
        auth: http::UpstreamAuthHeader {
            name: AUTHORIZATION,
            value,
        },
        extra_headers,
        proxy_url,
        selected_account_id: Some(selected_account_id),
        codex_openai_device_id: record
            .openai_device_id
            .clone()
            .filter(|value| !value.trim().is_empty()),
    })
}

async fn resolve_xai_upstream(
    state: &ProxyState,
    upstream: &UpstreamRuntime,
    upstream_path_with_query: &str,
    cooldown_scope: &CooldownScope,
) -> Result<ResolvedUpstreamAuth, AttemptOutcome> {
    let has_pinned_account = upstream
        .xai_account_id
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| !value.is_empty());
    let ordered_account_ids = if has_pinned_account {
        None
    } else {
        Some(ordered_runtime_account_ids(state, "xai", cooldown_scope).await)
    };
    let (selected_account_id, record) = state
        .xai_accounts
        .resolve_account_record_with_order(
            upstream.xai_account_id.as_deref(),
            ordered_account_ids.as_deref(),
        )
        .await
        .map_err(|err| account_resolution_outcome("xAI", has_pinned_account, err))?;
    let global_proxy_url = state.xai_accounts.app_proxy_url().await;
    let proxy_url = record
        .proxy_url
        .clone()
        .or_else(|| upstream.proxy_url.clone())
        .or(global_proxy_url);
    let value = http::bearer_header(&record.access_token).ok_or_else(|| {
        AttemptOutcome::Fatal(http::error_response(
            StatusCode::UNAUTHORIZED,
            "Upstream access token contains invalid characters.",
        ))
    })?;
    let auth = http::UpstreamAuthHeader {
        name: AUTHORIZATION,
        value,
    };
    let mut protected_headers = HeaderMap::new();
    protected_headers.insert(auth.name.clone(), auth.value.clone());
    Ok(ResolvedUpstreamAuth {
        upstream_url: xai_request_url(upstream_path_with_query),
        auth,
        extra_headers: Some(protected_headers),
        proxy_url,
        selected_account_id: Some(selected_account_id),
        codex_openai_device_id: None,
    })
}

fn account_resolution_outcome(
    provider_label: &str,
    has_pinned_account: bool,
    err: String,
) -> AttemptOutcome {
    let response = http::error_response(StatusCode::UNAUTHORIZED, err.clone());
    if has_pinned_account {
        return AttemptOutcome::Fatal(response);
    }
    tracing::warn!(provider = provider_label, error = %err, "account provider has no usable runtime credential");
    AttemptOutcome::Retryable {
        message: err,
        response: Some(response),
        is_timeout: false,
        should_cooldown: false,
        deferred_log: None,
    }
}

pub(super) async fn ordered_runtime_account_ids(
    state: &ProxyState,
    provider: &str,
    cooldown_scope: &CooldownScope,
) -> Vec<String> {
    // 候选集合只收 effective Active（可调度）账号。
    // disabled/expired/invalid 不应进入 cooldown 排序与 resolve 候选，避免无用 refresh 副作用。
    let account_ids = match provider {
        "kiro" => state.kiro_accounts.list_accounts().await.map(|items| {
            items
                .into_iter()
                .filter(|item| {
                    matches!(
                        item.status,
                        token_proxy_account_kiro::KiroAccountStatus::Active
                    )
                })
                .map(|item| item.account_id)
                .collect::<Vec<_>>()
        }),
        "codex" => state.codex_accounts.list_accounts().await.map(|items| {
            items
                .into_iter()
                .filter(|item| {
                    matches!(
                        item.status,
                        token_proxy_account_codex::CodexAccountStatus::Active
                    )
                })
                .map(|item| item.account_id)
                .collect::<Vec<_>>()
        }),
        "xai" => state.xai_accounts.list_accounts().await.map(|items| {
            items
                .into_iter()
                .filter(|item| {
                    matches!(
                        item.status,
                        token_proxy_account_xai::XaiAccountStatus::Active
                    ) || (matches!(
                        item.status,
                        token_proxy_account_xai::XaiAccountStatus::Expired
                    ) && item.auto_refresh_enabled)
                })
                .map(|item| item.account_id)
                .collect::<Vec<_>>()
        }),
        _ => Ok(Vec::new()),
    }
    .unwrap_or_default();
    tracing::debug!(
        provider,
        candidate_count = account_ids.len(),
        "ordered runtime account candidates after active filter"
    );
    state
        .account_selector
        .order_accounts_scoped(provider, &account_ids, cooldown_scope)
}

const XAI_TOKEN_AUTH_HEADER: HeaderName =
    HeaderName::from_static(token_proxy_account_xai::CLI_TOKEN_AUTH_HEADER);
const XAI_CLIENT_VERSION_HEADER: HeaderName =
    HeaderName::from_static(token_proxy_account_xai::CLI_CLIENT_VERSION_HEADER);
const XAI_CONVERSATION_ID_HEADER: HeaderName = HeaderName::from_static("x-grok-conv-id");

pub(super) fn xai_request_url(upstream_path_with_query: &str) -> String {
    let base_url = if is_xai_official_api_path(upstream_path_with_query) {
        token_proxy_account_xai::OFFICIAL_API_BASE_URL
    } else {
        token_proxy_account_xai::CLI_BASE_URL
    };
    // 两个受信 base URL 都以 `/v1` 结尾；只消除这一段固定重叠，禁止通用自定义主机拼接。
    let path = upstream_path_with_query
        .strip_prefix("/v1")
        .unwrap_or(upstream_path_with_query);
    format!("{}{path}", base_url.trim_end_matches('/'))
}

fn is_xai_official_api_path(path_with_query: &str) -> bool {
    let path = xai_request_path(path_with_query);
    path == "/v1/responses/compact"
        || path == "/v1/videos"
        || path.starts_with("/v1/videos/")
        || path == "/v1/images"
        || path.starts_with("/v1/images/")
}

fn xai_request_path(path_with_query: &str) -> &str {
    path_with_query
        .split_once('?')
        .map_or(path_with_query, |(path, _)| path)
}

fn is_xai_image_edits_path(path_with_query: &str) -> bool {
    xai_request_path(path_with_query) == "/v1/images/edits"
}

fn is_xai_video_content_path(path_with_query: &str) -> bool {
    let path = xai_request_path(path_with_query);
    path.strip_prefix("/v1/videos/")
        .and_then(|rest| rest.strip_suffix("/content"))
        .is_some_and(|request_id| !request_id.is_empty() && !request_id.contains('/'))
}

/// xAI OAuth 头在用户覆写之后强制应用，保证 bearer 与 CLI 身份不能被替换或外发。
pub(super) fn enforce_xai_request_headers(
    upstream_path_with_query: &str,
    body: &ReplayableBody,
    stream: bool,
    protected_headers: Option<&HeaderMap>,
    request_headers: &mut HeaderMap,
) {
    request_headers.remove(&XAI_TOKEN_AUTH_HEADER);
    request_headers.remove(&XAI_CLIENT_VERSION_HEADER);
    request_headers.remove(&XAI_CONVERSATION_ID_HEADER);
    if let Some(protected_headers) = protected_headers {
        for (name, value) in protected_headers {
            request_headers.insert(name.clone(), value.clone());
        }
    }
    if is_xai_official_api_path(upstream_path_with_query) {
        // Compact/媒体使用官方 API 合同，不携带任何 CLI 网关身份。
        request_headers.remove(USER_AGENT);
        if is_xai_image_edits_path(upstream_path_with_query) {
            // OpenAI-compatible image edits use multipart; the boundary belongs to the client body.
            request_headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
        } else if is_xai_video_content_path(upstream_path_with_query) {
            request_headers.remove(CONTENT_TYPE);
            request_headers.insert(ACCEPT, HeaderValue::from_static("*/*"));
        } else {
            request_headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
            request_headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
        }
        tracing::debug!(endpoint_kind = "official_api", "prepared xai oauth request");
        return;
    }

    request_headers.insert(
        XAI_TOKEN_AUTH_HEADER,
        HeaderValue::from_static(token_proxy_account_xai::CLI_TOKEN_AUTH_VALUE),
    );
    request_headers.insert(
        XAI_CLIENT_VERSION_HEADER,
        HeaderValue::from_static(token_proxy_account_xai::CLI_CLIENT_VERSION),
    );
    request_headers.insert(
        USER_AGENT,
        HeaderValue::from_static(token_proxy_account_xai::CLI_USER_AGENT),
    );
    request_headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    request_headers.insert(
        ACCEPT,
        HeaderValue::from_static(if stream {
            "text/event-stream"
        } else {
            "application/json"
        }),
    );
    let conversation_id = xai_conversation_id(body);
    if let Some(value) = conversation_id.as_ref() {
        request_headers.insert(XAI_CONVERSATION_ID_HEADER, value.clone());
    }
    tracing::debug!(
        endpoint_kind = "cli_text",
        has_conversation_id = conversation_id.is_some(),
        "prepared xai oauth request"
    );
}

fn xai_conversation_id(body: &ReplayableBody) -> Option<HeaderValue> {
    let value = serde_json::from_slice::<Value>(body.as_bytes()).ok()?;
    let value = value
        .get("prompt_cache_key")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())?;
    HeaderValue::from_str(value).ok()
}

pub(super) fn build_mapped_meta(meta: &RequestMeta, upstream: &UpstreamRuntime) -> RequestMeta {
    let upstream_input_model = meta.original_model.as_deref().map(|original| {
        strip_target_upstream_prefix(original, upstream.id.as_str())
            .unwrap_or_else(|| original.to_string())
    });
    let mapped_model = upstream_input_model
        .as_deref()
        .and_then(|original| upstream.map_model(original))
        .or_else(|| {
            let mapped_input = upstream_input_model.as_deref()?;
            let original = meta.original_model.as_deref()?;
            (mapped_input != original).then(|| mapped_input.to_string())
        });
    let (mapped_model, reasoning_effort) =
        normalize_mapped_model_reasoning_suffix(mapped_model, meta.reasoning_effort.clone());
    RequestMeta {
        client_ip: meta.client_ip.clone(),
        stream: meta.stream,
        original_model: meta.original_model.clone(),
        mapped_model,
        reasoning_effort,
        response_format: meta.response_format.clone(),
        estimated_input_tokens: meta.estimated_input_tokens,
    }
}

pub(super) fn requested_target_upstream_id(
    upstreams: &ProviderUpstreams,
    original_model: Option<&str>,
) -> Option<String> {
    let original_model = original_model?.trim();
    let (prefix, rest) = original_model.split_once('/')?;
    if prefix.trim().is_empty() || rest.trim().is_empty() {
        return None;
    }
    upstreams
        .groups
        .iter()
        .flat_map(|group| group.items.iter())
        .find(|upstream| upstream.id == prefix)
        .map(|upstream| upstream.id.clone())
}

fn strip_target_upstream_prefix(model: &str, upstream_id: &str) -> Option<String> {
    let (prefix, rest) = model.split_once('/')?;
    if prefix != upstream_id || rest.trim().is_empty() {
        return None;
    }
    Some(rest.to_string())
}

pub(super) fn normalize_mapped_model_reasoning_suffix(
    mapped_model: Option<String>,
    reasoning_effort: Option<String>,
) -> (Option<String>, Option<String>) {
    let Some(mapped_model) = mapped_model else {
        return (None, reasoning_effort);
    };
    let Some((base_model, mapped_effort)) =
        super::super::server_helpers::parse_openai_reasoning_effort_from_model_suffix(
            &mapped_model,
        )
    else {
        return (Some(mapped_model), reasoning_effort);
    };

    let reasoning_effort = reasoning_effort.or(Some(mapped_effort));
    (Some(base_model), reasoning_effort)
}

fn resolve_upstream_path_with_query(
    provider: &str,
    upstream_path_with_query: &str,
    meta: &RequestMeta,
) -> String {
    if provider != "gemini" || meta.model_override().is_none() {
        return upstream_path_with_query.to_string();
    }
    let Some(mapped_model) = meta.mapped_model.as_deref() else {
        return upstream_path_with_query.to_string();
    };
    let (path, query) = request::split_path_query(upstream_path_with_query);
    let replaced = gemini::replace_gemini_model_in_path(path, mapped_model)
        .unwrap_or_else(|| path.to_string());
    match query {
        Some(query) => format!("{replaced}?{query}"),
        None => replaced,
    }
}
