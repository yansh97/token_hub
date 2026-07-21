use axum::{
    http::{HeaderMap, Method, StatusCode},
    response::Response,
};

use super::super::http::RequestAuth;
use super::super::{
    config::UpstreamRuntime, openai_compat::FormatTransform, request_body::ReplayableBody,
    request_detail::RequestDetailSnapshot, ProxyState, RequestMeta,
};
use super::{attempt, result, AttemptOutcome};
use crate::proxy::cooldown_scope::CooldownScope;
use crate::proxy::http;
use crate::proxy::log::RequestTimings;
use crate::proxy::response::RetryableStreamResponse;
use crate::proxy::token_rate::RequestTokenTracker;

pub(super) struct UpstreamAttempt {
    pub(super) response: reqwest::Response,
    pub(super) selected_account_id: Option<String>,
    pub(super) meta: RequestMeta,
    pub(super) start_time: std::time::Instant,
    pub(super) timings: RequestTimings,
    /// 发送上游前已 register，覆盖 TTFB；成功后移入 response stream。
    pub(super) token_tracker: RequestTokenTracker,
}

pub(super) struct UpstreamAttemptFailure {
    pub(super) outcome: AttemptOutcome,
    pub(super) selected_account_id: Option<String>,
}

pub(super) enum AccountFailoverResult {
    Pending(UpstreamAttempt),
    Resolved(AttemptOutcome),
}

pub(super) async fn retry_after_kiro_refresh(
    state: &ProxyState,
    method: Method,
    provider: &str,
    upstream: &UpstreamRuntime,
    inbound_path: &str,
    upstream_path_with_query: &str,
    headers: &HeaderMap,
    body: &ReplayableBody,
    meta: &RequestMeta,
    request_auth: &RequestAuth,
    client_gemini_api_key: Option<&str>,
    response_transform: FormatTransform,
    request_detail: Option<RequestDetailSnapshot>,
    first: &UpstreamAttempt,
    cooldown_scope: &CooldownScope,
) -> Option<AttemptOutcome> {
    if !should_refresh_kiro(provider, &first.response) {
        return None;
    }
    if let Err(outcome) = refresh_kiro_account(state, upstream).await {
        return Some(outcome);
    }
    let retry = match attempt::attempt_send(
        state,
        method,
        provider,
        upstream,
        inbound_path,
        upstream_path_with_query,
        headers,
        body,
        meta,
        request_auth,
        request_detail.as_ref(),
        cooldown_scope,
    )
    .await
    {
        Ok(attempt) => attempt,
        Err(failure) => return Some(failure.outcome),
    };
    Some(
        finalize_attempt(
            state,
            provider,
            upstream,
            inbound_path,
            client_gemini_api_key,
            response_transform,
            request_detail,
            retry,
            cooldown_scope,
        )
        .await,
    )
}

pub(super) async fn finalize_attempt(
    state: &ProxyState,
    provider: &str,
    upstream: &UpstreamRuntime,
    inbound_path: &str,
    client_gemini_api_key: Option<&str>,
    response_transform: FormatTransform,
    request_detail: Option<RequestDetailSnapshot>,
    attempt: UpstreamAttempt,
    cooldown_scope: &CooldownScope,
) -> AttemptOutcome {
    schedule_account_response_tasks(
        state,
        provider,
        attempt.selected_account_id.as_deref(),
        &attempt.response,
    );
    result::handle_upstream_result(
        state,
        Ok(attempt.response),
        &attempt.meta,
        provider,
        &upstream.id,
        attempt.selected_account_id.clone(),
        inbound_path,
        state.log.clone(),
        attempt.token_tracker,
        attempt.start_time,
        attempt.timings,
        client_gemini_api_key,
        response_transform,
        request_detail,
        cooldown_scope,
    )
    .await
}

pub(super) fn mark_account_retryable_failure(
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

pub(super) async fn retry_with_next_account(
    state: &ProxyState,
    method: Method,
    provider: &str,
    upstream: &UpstreamRuntime,
    inbound_path: &str,
    upstream_path_with_query: &str,
    headers: &HeaderMap,
    body: &ReplayableBody,
    meta: &RequestMeta,
    request_auth: &RequestAuth,
    client_gemini_api_key: Option<&str>,
    response_transform: FormatTransform,
    request_detail: Option<RequestDetailSnapshot>,
    first: Result<UpstreamAttempt, UpstreamAttemptFailure>,
    cooldown_scope: &CooldownScope,
) -> AccountFailoverResult {
    if !matches!(provider, "codex" | "xai") {
        return match first {
            Ok(attempt) => AccountFailoverResult::Pending(attempt),
            Err(failure) => AccountFailoverResult::Resolved(failure.outcome),
        };
    }

    let has_pinned_account = provider_account_id(provider, upstream)
        .map(str::trim)
        .is_some_and(|value| !value.is_empty());
    let mut excluded_account_ids = Vec::new();
    let mut current_upstream = upstream.clone();
    let mut current_attempt = first;

    loop {
        current_attempt = retry_after_account_refresh(
            state,
            method.clone(),
            provider,
            &current_upstream,
            inbound_path,
            upstream_path_with_query,
            headers,
            body,
            meta,
            request_auth,
            current_attempt,
            request_detail.as_ref(),
            cooldown_scope,
        )
        .await;
        let selected_account_id = attempt_selected_account_id(&current_attempt);
        let outcome = finalize_account_failover_attempt(
            state,
            provider,
            &current_upstream,
            inbound_path,
            client_gemini_api_key,
            response_transform,
            request_detail.clone(),
            current_attempt,
            cooldown_scope,
        )
        .await;
        if !should_failover_account_outcome(provider, &outcome) || has_pinned_account {
            return AccountFailoverResult::Resolved(outcome);
        }
        let Some(selected_account_id) = selected_account_id else {
            return AccountFailoverResult::Resolved(outcome);
        };
        if !excluded_account_ids
            .iter()
            .any(|account_id| account_id == &selected_account_id)
        {
            excluded_account_ids.push(selected_account_id);
        }

        // 与首跳一致：只从 Active 候选里做 failover，禁用账号不进入轮询集合。
        let next_account_id =
            match resolve_next_account_id(state, provider, &excluded_account_ids, cooldown_scope)
                .await
            {
                Ok(Some(account_id)) => account_id,
                Ok(None) => return AccountFailoverResult::Resolved(outcome),
                Err(err) => {
                    return AccountFailoverResult::Resolved(AttemptOutcome::Fatal(
                        http::error_response(StatusCode::UNAUTHORIZED, err),
                    ));
                }
            };

        current_upstream = upstream.clone();
        pin_account(provider, &mut current_upstream, next_account_id);
        current_attempt = attempt::attempt_send(
            state,
            method.clone(),
            provider,
            &current_upstream,
            inbound_path,
            upstream_path_with_query,
            headers,
            body,
            meta,
            request_auth,
            request_detail.as_ref(),
            cooldown_scope,
        )
        .await;
    }
}

async fn retry_after_account_refresh(
    state: &ProxyState,
    method: Method,
    provider: &str,
    upstream: &UpstreamRuntime,
    inbound_path: &str,
    upstream_path_with_query: &str,
    headers: &HeaderMap,
    body: &ReplayableBody,
    meta: &RequestMeta,
    request_auth: &RequestAuth,
    attempt: Result<UpstreamAttempt, UpstreamAttemptFailure>,
    request_detail: Option<&RequestDetailSnapshot>,
    cooldown_scope: &CooldownScope,
) -> Result<UpstreamAttempt, UpstreamAttemptFailure> {
    let Ok(first) = attempt else {
        return attempt;
    };
    if !should_refresh_account(provider, &first.response) {
        return Ok(first);
    }
    let Some(account_id) = first.selected_account_id.clone() else {
        return Ok(first);
    };
    if let Err(err) = refresh_account(state, provider, &account_id).await {
        tracing::warn!(
            provider,
            account_id,
            error = %err,
            "account refresh after unauthorized failed"
        );
        return Ok(first);
    }
    tracing::info!(
        provider,
        account_id,
        "account refreshed after unauthorized response"
    );
    let mut retry_upstream = upstream.clone();
    pin_account(provider, &mut retry_upstream, account_id);
    attempt::attempt_send(
        state,
        method,
        provider,
        &retry_upstream,
        inbound_path,
        upstream_path_with_query,
        headers,
        body,
        meta,
        request_auth,
        request_detail,
        cooldown_scope,
    )
    .await
}

async fn finalize_account_failover_attempt(
    state: &ProxyState,
    provider: &str,
    upstream: &UpstreamRuntime,
    inbound_path: &str,
    client_gemini_api_key: Option<&str>,
    response_transform: FormatTransform,
    request_detail: Option<RequestDetailSnapshot>,
    attempt: Result<UpstreamAttempt, UpstreamAttemptFailure>,
    cooldown_scope: &CooldownScope,
) -> AttemptOutcome {
    match attempt {
        Ok(attempt) => {
            finalize_attempt(
                state,
                provider,
                upstream,
                inbound_path,
                client_gemini_api_key,
                response_transform,
                request_detail,
                attempt,
                cooldown_scope,
            )
            .await
        }
        Err(failure) => failure.outcome,
    }
}

fn attempt_selected_account_id(
    attempt: &Result<UpstreamAttempt, UpstreamAttemptFailure>,
) -> Option<String> {
    match attempt {
        Ok(attempt) => attempt.selected_account_id.clone(),
        Err(failure) => failure.selected_account_id.clone(),
    }
}

fn should_failover_account_outcome(provider: &str, outcome: &AttemptOutcome) -> bool {
    if provider == "xai" {
        return match outcome {
            AttemptOutcome::Success(response) => {
                should_failover_xai_status(xai_outcome_status(response))
            }
            AttemptOutcome::Retryable {
                response: Some(response),
                ..
            } => should_failover_xai_status(xai_outcome_status(response)),
            AttemptOutcome::Retryable { response: None, .. } => true,
            AttemptOutcome::Fatal(_) | AttemptOutcome::SkippedAuth => false,
        };
    }
    match outcome {
        AttemptOutcome::Success(response) => {
            let status = response.status();
            // 304 是条件请求成功命中缓存，继续切换账号会破坏 ETag 语义。
            !status.is_success() && status != StatusCode::NOT_MODIFIED
        }
        AttemptOutcome::Retryable { .. } => true,
        AttemptOutcome::Fatal(_) | AttemptOutcome::SkippedAuth => false,
    }
}

fn xai_outcome_status(response: &Response) -> StatusCode {
    response
        .extensions()
        .get::<RetryableStreamResponse>()
        .map_or_else(|| response.status(), |marker| marker.status)
}

fn should_failover_xai_status(status: StatusCode) -> bool {
    matches!(
        status,
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN | StatusCode::TOO_MANY_REQUESTS
    ) || status.is_server_error()
}

fn schedule_account_response_tasks(
    state: &ProxyState,
    provider: &str,
    account_id: Option<&str>,
    response: &reqwest::Response,
) {
    let Some(account_id) = account_id.map(str::trim).filter(|value| !value.is_empty()) else {
        return;
    };
    let account_id = account_id.to_string();
    match provider {
        "kiro" if response.status().is_success() => {
            let store = state.kiro_accounts.clone();
            tokio::spawn(async move {
                let _ = store.refresh_quota_if_stale(&account_id).await;
            });
        }
        "codex" if response.status().is_success() => {
            let store = state.codex_accounts.clone();
            tokio::spawn(async move {
                let _ = store.refresh_quota_if_stale(&account_id).await;
            });
        }
        "xai" => {
            let store = state.xai_accounts.clone();
            let headers = response.headers().clone();
            let status = response.status().as_u16();
            tokio::spawn(async move {
                if let Err(error) = store
                    .record_quota_headers(&account_id, &headers, status)
                    .await
                {
                    tracing::warn!(
                        account_id,
                        status,
                        error = %error,
                        "xai response quota snapshot persistence failed"
                    );
                }
            });
        }
        _ => {}
    }
}

fn should_refresh_kiro(provider: &str, response: &reqwest::Response) -> bool {
    provider == "kiro"
        && (response.status() == StatusCode::UNAUTHORIZED
            || response.status() == StatusCode::FORBIDDEN)
}

fn should_refresh_account(provider: &str, response: &reqwest::Response) -> bool {
    matches!(provider, "codex" | "xai") && response.status() == StatusCode::UNAUTHORIZED
}

async fn refresh_account(
    state: &ProxyState,
    provider: &str,
    account_id: &str,
) -> Result<(), String> {
    match provider {
        "codex" => state.codex_accounts.refresh_account(account_id).await,
        "xai" => state.xai_accounts.refresh_account(account_id).await,
        _ => Err(format!(
            "Provider {provider} does not support account refresh."
        )),
    }
}

async fn resolve_next_account_id(
    state: &ProxyState,
    provider: &str,
    excluded_account_ids: &[String],
    cooldown_scope: &CooldownScope,
) -> Result<Option<String>, String> {
    let ordered_account_ids = super::ordered_runtime_account_ids(state, provider, cooldown_scope)
        .await
        .into_iter()
        .filter(|account_id| !excluded_account_ids.contains(account_id))
        .collect::<Vec<_>>();
    if ordered_account_ids.is_empty() {
        return Ok(None);
    }
    match provider {
        "codex" => state
            .codex_accounts
            .resolve_next_account_record_with_order(
                excluded_account_ids,
                Some(ordered_account_ids.as_slice()),
            )
            .await
            .map(|resolved| resolved.map(|(account_id, _)| account_id)),
        "xai" => state
            .xai_accounts
            .resolve_account_record_with_order(None, Some(ordered_account_ids.as_slice()))
            .await
            .map(|(account_id, _)| Some(account_id)),
        _ => Ok(None),
    }
}

fn provider_account_id<'a>(provider: &str, upstream: &'a UpstreamRuntime) -> Option<&'a str> {
    match provider {
        "codex" => upstream.codex_account_id.as_deref(),
        "xai" => upstream.xai_account_id.as_deref(),
        _ => None,
    }
}

pub(super) fn pin_account_if_missing(
    provider: &str,
    upstream: &mut UpstreamRuntime,
    account_id: Option<&str>,
) {
    if provider_account_id(provider, upstream)
        .map(str::trim)
        .is_some_and(|value| !value.is_empty())
    {
        return;
    }
    let Some(account_id) = account_id.map(str::trim).filter(|value| !value.is_empty()) else {
        return;
    };
    pin_account(provider, upstream, account_id.to_string());
}

fn pin_account(provider: &str, upstream: &mut UpstreamRuntime, account_id: String) {
    match provider {
        "codex" => upstream.codex_account_id = Some(account_id),
        "xai" => upstream.xai_account_id = Some(account_id),
        _ => {}
    }
}

async fn refresh_kiro_account(
    state: &ProxyState,
    upstream: &UpstreamRuntime,
) -> Result<(), AttemptOutcome> {
    let Some(account_id) = upstream.kiro_account_id.as_deref() else {
        return Err(AttemptOutcome::Fatal(http::error_response(
            StatusCode::UNAUTHORIZED,
            "Kiro account is not configured.",
        )));
    };
    state
        .kiro_accounts
        .refresh_account(account_id)
        .await
        .map_err(|err| AttemptOutcome::Fatal(http::error_response(StatusCode::UNAUTHORIZED, err)))
}

#[cfg(test)]
#[path = "retry.test.rs"]
mod tests;
