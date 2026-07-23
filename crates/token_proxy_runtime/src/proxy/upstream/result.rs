use std::sync::Arc;
use std::time::Instant;

use axum::{http::StatusCode, response::Response};

use super::dispatch::ForwardAttemptState;
use super::utils::{is_retryable_error, is_retryable_status, sanitize_upstream_error};
use super::{AttemptOutcome, RetryDirective, RetryScope};
use crate::proxy::account_selector::AccountSelectorRuntime;
use crate::proxy::cooldown_scope::CooldownScope;
use crate::proxy::http;
use crate::proxy::log::{build_log_entry, LogContext, LogWriter, RequestTimings, UsageSnapshot};
use crate::proxy::openai_compat::FormatTransform;
use crate::proxy::request_detail::RequestDetailSnapshot;
use crate::proxy::response::{
    build_proxy_response, build_proxy_response_buffered, AccountCooldownHint,
    NonRetryableSemanticResponse, RetryableStreamResponse,
};
use crate::proxy::token_rate::RequestTokenTracker;
use crate::proxy::ProxyState;
use crate::proxy::RequestMeta;
use token_proxy_config::ProviderUpstreams;
use token_proxy_protocol::xai_client_tools::XaiClientToolMapping;

const LOCAL_UPSTREAM_ID: &str = "local";

pub(crate) struct ForwardUpstreamResult {
    pub(crate) response: Response,
    pub(crate) should_fallback: bool,
}

pub(super) fn should_cooldown_retryable_status(status: StatusCode) -> bool {
    // cooldown 只用于“更像上游账号/节点短时异常”的错误，避免把请求内容问题扩散到后续请求。
    // 因此 400/404/422/307 虽然可在当前请求内换路重试，但不会跨请求冷却整个 upstream。
    matches!(
        status,
        StatusCode::UNAUTHORIZED
            | StatusCode::FORBIDDEN
            | StatusCode::REQUEST_TIMEOUT
            | StatusCode::TOO_MANY_REQUESTS
    ) || status.is_server_error()
}

pub(super) async fn handle_upstream_result(
    state: &ProxyState,
    upstream_res: Result<reqwest::Response, reqwest::Error>,
    meta: &RequestMeta,
    provider: &str,
    upstream_id: &str,
    account_id: Option<String>,
    inbound_path: &str,
    log: Arc<LogWriter>,
    request_tracker: RequestTokenTracker,
    start_time: Instant,
    timings: RequestTimings,
    client_gemini_api_key: Option<&str>,
    response_transform: FormatTransform,
    xai_client_tools: Option<XaiClientToolMapping>,
    request_detail: Option<RequestDetailSnapshot>,
    cooldown_scope: &CooldownScope,
) -> AttemptOutcome {
    let account_id_value = account_id.as_deref().map(str::to_string);
    let proxy_base_url = http::local_proxy_base_url(&state.config);
    match upstream_res {
        Ok(res) if is_retryable_status(res.status()) => {
            let status = res.status();
            let response_headers = res.headers().clone();
            let response = build_proxy_response_buffered(
                meta,
                provider,
                upstream_id,
                account_id_value.clone(),
                inbound_path,
                res,
                log,
                request_tracker,
                start_time,
                timings.clone(),
                &proxy_base_url,
                client_gemini_api_key,
                response_transform,
                xai_client_tools.clone(),
                request_detail.clone(),
                state.config.sync_response_timeout,
            )
            .await;
            if response
                .extensions()
                .get::<NonRetryableSemanticResponse>()
                .is_some()
            {
                return AttemptOutcome::Success(response);
            }
            update_account_cooldown_from_response(
                &state.account_selector,
                provider,
                account_id_value.as_deref(),
                status,
                &response_headers,
                &response,
                cooldown_scope,
            );
            let mut response = response;
            if status == StatusCode::PAYLOAD_TOO_LARGE {
                response.extensions_mut().insert(RetryDirective {
                    scope: RetryScope::NextOnly,
                    effective_body: None,
                });
            }
            let retryable_response = response
                .extensions()
                .get::<RetryableStreamResponse>()
                .cloned();
            let should_cooldown = retryable_response.as_ref().map_or_else(
                || should_cooldown_retryable_status(status),
                |retryable| retryable.should_cooldown,
            );
            AttemptOutcome::Retryable {
                message: format!("Upstream responded with {}", response.status()),
                response: Some(response),
                is_timeout: false,
                should_cooldown,
                deferred_log: None,
            }
        }
        Ok(res) => {
            let status = res.status();
            let response_headers = res.headers().clone();
            let response = build_proxy_response(
                meta,
                provider,
                upstream_id,
                account_id_value.clone(),
                inbound_path,
                res,
                log,
                request_tracker,
                start_time,
                timings,
                &proxy_base_url,
                client_gemini_api_key,
                response_transform,
                xai_client_tools,
                request_detail.clone(),
                state.config.stream_first_output_timeout,
                state.config.sync_response_timeout,
            )
            .await;
            if let Some(retryable) = response
                .extensions()
                .get::<RetryableStreamResponse>()
                .cloned()
            {
                if retryable.should_cooldown
                    || response.extensions().get::<AccountCooldownHint>().is_some()
                {
                    update_account_cooldown_from_response(
                        &state.account_selector,
                        provider,
                        account_id_value.as_deref(),
                        retryable.status,
                        &response_headers,
                        &response,
                        cooldown_scope,
                    );
                }
                return AttemptOutcome::Retryable {
                    message: retryable.message,
                    response: Some(response),
                    is_timeout: false,
                    should_cooldown: retryable.should_cooldown,
                    deferred_log: None,
                };
            }
            update_account_cooldown_from_status(
                state,
                provider,
                account_id_value.as_deref(),
                status,
                &response_headers,
                cooldown_scope,
            );
            AttemptOutcome::Success(response)
        }
        Err(err) if is_retryable_error(&err) => {
            // 无 response body 可统计，释放发送前 register 的窗口。
            drop(request_tracker);
            let message = sanitize_upstream_error(provider, &err);
            mark_retryable_account_failure(
                state,
                provider,
                account_id_value.as_deref(),
                Some(message.clone()),
                cooldown_scope,
            );
            // 延后到本请求终态失败再写 SQLite，避免中间 attempt 刷 502。
            AttemptOutcome::Retryable {
                message: message.clone(),
                response: None,
                is_timeout: err.is_timeout(),
                should_cooldown: true,
                deferred_log: Some(message),
            }
        }
        Err(err) => {
            drop(request_tracker);
            let message = sanitize_upstream_error(provider, &err);
            log_upstream_error_if_needed(
                &log,
                request_detail.as_ref(),
                meta,
                provider,
                upstream_id,
                account_id.as_deref(),
                inbound_path,
                StatusCode::BAD_GATEWAY,
                format!("Upstream request failed: {message}"),
                start_time,
            );
            AttemptOutcome::Fatal(http::error_response(
                StatusCode::BAD_GATEWAY,
                format!("Upstream request failed: {message}"),
            ))
        }
    }
}

pub(super) fn resolve_provider_upstreams<'a>(
    state: &'a ProxyState,
    provider: &str,
    inbound_path: &str,
    meta: &RequestMeta,
    request_detail: Option<&RequestDetailSnapshot>,
) -> Result<&'a ProviderUpstreams, Response> {
    match state.config.provider_upstreams(provider) {
        Some(upstreams) => Ok(upstreams),
        None => {
            log_upstream_error_if_needed(
                &state.log,
                request_detail,
                meta,
                provider,
                LOCAL_UPSTREAM_ID,
                None,
                inbound_path,
                StatusCode::BAD_GATEWAY,
                "No available upstream configured.".to_string(),
                Instant::now(),
            );
            Err(http::error_response(
                StatusCode::BAD_GATEWAY,
                "No available upstream configured.",
            ))
        }
    }
}

pub(super) fn finalize_forward_result(
    state: &ProxyState,
    provider: &str,
    inbound_path: &str,
    meta: &RequestMeta,
    request_detail: Option<&RequestDetailSnapshot>,
    summary: ForwardAttemptState,
) -> ForwardUpstreamResult {
    if let Some(response) = summary.response {
        return ForwardUpstreamResult {
            response,
            should_fallback: false,
        };
    }
    let should_fallback = summary.last_retry_response.is_some()
        || summary.last_timeout_error.is_some()
        || summary.last_retry_error.is_some()
        || summary.attempted == 0;
    let response = finalize_forward_response(
        &state.log,
        provider,
        inbound_path,
        meta,
        request_detail,
        summary,
    );
    ForwardUpstreamResult {
        response,
        should_fallback,
    }
}

fn finalize_forward_response(
    log: &Arc<LogWriter>,
    provider: &str,
    inbound_path: &str,
    meta: &RequestMeta,
    request_detail: Option<&RequestDetailSnapshot>,
    summary: ForwardAttemptState,
) -> Response {
    if summary.attempted == 0 && summary.missing_auth {
        log_upstream_error_if_needed(
            log,
            request_detail,
            meta,
            provider,
            LOCAL_UPSTREAM_ID,
            None,
            inbound_path,
            StatusCode::BAD_GATEWAY,
            "Missing upstream API key.".to_string(),
            Instant::now(),
        );
        tracing::warn!(
            provider,
            status = StatusCode::BAD_GATEWAY.as_u16(),
            exclusion_reason = "missing_upstream_credential",
            "request rejected because upstream credential is not configured"
        );
        return http::error_response(StatusCode::BAD_GATEWAY, "Missing upstream API key.");
    }
    if summary.attempted == 0 && summary.model_unsupported {
        let message = format!(
            "Model '{}' is not supported by any configured upstream.",
            meta.original_model.as_deref().unwrap_or("unknown")
        );
        log_upstream_error_if_needed(
            log,
            request_detail,
            meta,
            provider,
            LOCAL_UPSTREAM_ID,
            None,
            inbound_path,
            StatusCode::NOT_FOUND,
            message.clone(),
            Instant::now(),
        );
        tracing::warn!(
            provider,
            model = meta.original_model.as_deref().unwrap_or(""),
            status = StatusCode::NOT_FOUND.as_u16(),
            exclusion_reason = "model_not_supported",
            "request rejected because no upstream supports the model"
        );
        return http::error_response(StatusCode::NOT_FOUND, message);
    }
    if let Some(response) = summary.last_retry_response {
        return response;
    }
    // 仅终态失败落一条 deferred transport 诊断（中间 attempt 已跳过写库）。
    if let Some(deferred) = summary.last_deferred_log.as_ref() {
        let status = StatusCode::from_u16(deferred.status).unwrap_or(StatusCode::BAD_GATEWAY);
        let upstream_id = if deferred.upstream_id.is_empty() {
            LOCAL_UPSTREAM_ID
        } else {
            deferred.upstream_id.as_str()
        };
        log_upstream_error_if_needed(
            log,
            request_detail,
            meta,
            provider,
            upstream_id,
            deferred.account_id.as_deref(),
            inbound_path,
            status,
            deferred.message.clone(),
            deferred.start_time,
        );
    }
    if let Some(err) = summary.last_timeout_error {
        return http::error_response(StatusCode::GATEWAY_TIMEOUT, err);
    }
    if let Some(err) = summary.last_retry_error {
        return http::error_response(
            StatusCode::BAD_GATEWAY,
            format!("Upstream request failed: {err}"),
        );
    }
    http::error_response(StatusCode::BAD_GATEWAY, "No available upstream configured.")
}

fn update_account_cooldown_from_status(
    state: &ProxyState,
    provider: &str,
    account_id: Option<&str>,
    status: StatusCode,
    headers: &reqwest::header::HeaderMap,
    cooldown_scope: &CooldownScope,
) {
    let Some(account_id) = account_id.map(str::trim).filter(|value| !value.is_empty()) else {
        return;
    };
    if status.is_success() {
        state
            .account_selector
            .clear_cooldown_scoped(provider, account_id, cooldown_scope);
        return;
    }
    let _ = state.account_selector.mark_response_status_scoped(
        provider,
        account_id,
        status,
        headers,
        cooldown_scope,
    );
}

fn update_account_cooldown_from_response(
    account_selector: &AccountSelectorRuntime,
    provider: &str,
    account_id: Option<&str>,
    status: StatusCode,
    headers: &reqwest::header::HeaderMap,
    response: &Response,
    cooldown_scope: &CooldownScope,
) {
    let Some(account_id) = account_id.map(str::trim).filter(|value| !value.is_empty()) else {
        return;
    };
    if let Some(hint) = response.extensions().get::<AccountCooldownHint>() {
        let until = account_selector.mark_explicit_cooldown_scoped(
            provider,
            account_id,
            hint.duration,
            cooldown_scope,
        );
        tracing::warn!(
            provider,
            account_id,
            reason = hint.reason,
            cooldown_seconds = hint.duration.as_secs(),
            cooldown_until_epoch_ms = until,
            "account entered provider-directed cooldown"
        );
        return;
    }
    let _ = account_selector.mark_response_status_scoped(
        provider,
        account_id,
        status,
        headers,
        cooldown_scope,
    );
}

fn mark_retryable_account_failure(
    state: &ProxyState,
    provider: &str,
    account_id: Option<&str>,
    _reason_detail: Option<String>,
    cooldown_scope: &CooldownScope,
) {
    let Some(account_id) = account_id.map(str::trim).filter(|value| !value.is_empty()) else {
        return;
    };
    let _ =
        state
            .account_selector
            .mark_retryable_failure_scoped(provider, account_id, cooldown_scope);
}

pub(super) fn log_upstream_error_if_needed(
    log: &Arc<LogWriter>,
    request_detail: Option<&RequestDetailSnapshot>,
    meta: &RequestMeta,
    provider: &str,
    upstream_id: &str,
    account_id: Option<&str>,
    inbound_path: &str,
    status: StatusCode,
    response_error: String,
    start_time: Instant,
) {
    let (request_headers, request_body) = request_detail
        .map(|detail| (detail.request_headers.clone(), detail.request_body.clone()))
        .unwrap_or((None, None));
    let context = LogContext {
        client_ip: meta.client_ip.clone(),
        path: inbound_path.to_string(),
        provider: provider.to_string(),
        upstream_id: upstream_id.to_string(),
        account_id: account_id.map(str::to_string),
        model: meta.original_model.clone(),
        mapped_model: meta.mapped_model.clone(),
        stream: meta.stream,
        status: status.as_u16(),
        upstream_request_id: None,
        request_headers,
        request_body,
        ttfb_ms: None,
        timings: RequestTimings::with_billing(meta.billing.clone()),
        start: start_time,
    };
    let usage = UsageSnapshot::default();
    let entry = build_log_entry(&context, usage, Some(response_error));
    log.clone().write_detached(entry);
}

#[cfg(test)]
#[path = "result.test.rs"]
mod tests;
