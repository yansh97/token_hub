use serde::Deserialize;
use std::fmt;

/// OAuth 错误只保留状态和标准错误码，避免把 token 或完整响应体写入日志/UI。
#[derive(Clone, Debug)]
pub(crate) struct XaiOAuthError {
    message: String,
    invalid_grant: bool,
}

impl XaiOAuthError {
    pub(crate) fn response(status: u16, body: &[u8]) -> Self {
        let code = serde_json::from_slice::<OAuthErrorPayload>(body)
            .ok()
            .map(|payload| normalize_error_code(&payload.error))
            .unwrap_or("unknown_error");
        Self {
            invalid_grant: matches!(
                code,
                "invalid_grant"
                    | "invalid_refresh_token"
                    | "token_expired"
                    | "refresh_token_reused"
                    | "refresh_token_invalidated"
                    | "app_session_terminated"
            ),
            message: format!("xAI OAuth request failed with status {status} ({code})."),
        }
    }

    pub(crate) fn request(context: &str, error: reqwest::Error) -> Self {
        // reqwest 的 Display 可能包含完整 URL/query；只保留稳定错误类别。
        let kind = request_failure_kind(&error);
        tracing::debug!(context, kind, "xai oauth network request failed");
        Self {
            invalid_grant: false,
            message: format!("xAI OAuth {context} failed ({kind})."),
        }
    }

    pub(crate) fn invalid(message: impl Into<String>) -> Self {
        Self {
            invalid_grant: false,
            message: message.into(),
        }
    }

    pub(crate) fn is_invalid_grant(&self) -> bool {
        self.invalid_grant
    }
}

impl fmt::Display for XaiOAuthError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for XaiOAuthError {}

#[derive(Deserialize)]
struct OAuthErrorPayload {
    error: String,
}

fn normalize_error_code(value: &str) -> &'static str {
    let value = value.trim().to_ascii_lowercase();
    match value.as_str() {
        // OAuth 2.0 / OIDC / Device Authorization Grant 标准错误码。
        "invalid_request" => "invalid_request",
        "invalid_client" => "invalid_client",
        "invalid_grant" => "invalid_grant",
        "unauthorized_client" => "unauthorized_client",
        "unsupported_grant_type" => "unsupported_grant_type",
        "unsupported_response_type" => "unsupported_response_type",
        "invalid_scope" => "invalid_scope",
        "authorization_pending" => "authorization_pending",
        "slow_down" => "slow_down",
        "access_denied" => "access_denied",
        "expired_token" => "expired_token",
        "server_error" => "server_error",
        "temporarily_unavailable" => "temporarily_unavailable",
        "interaction_required" => "interaction_required",
        "login_required" => "login_required",
        "account_selection_required" => "account_selection_required",
        "consent_required" => "consent_required",
        "invalid_request_uri" => "invalid_request_uri",
        "invalid_request_object" => "invalid_request_object",
        "request_not_supported" => "request_not_supported",
        "request_uri_not_supported" => "request_uri_not_supported",
        "registration_not_supported" => "registration_not_supported",
        // xAI 刷新端点已观察到的凭证失效错误码。
        "invalid_refresh_token" => "invalid_refresh_token",
        "token_expired" => "token_expired",
        "refresh_token_reused" => "refresh_token_reused",
        "refresh_token_invalidated" => "refresh_token_invalidated",
        "app_session_terminated" => "app_session_terminated",
        _ => "unknown_error",
    }
}

fn request_failure_kind(error: &reqwest::Error) -> &'static str {
    if error.is_timeout() {
        "timeout"
    } else if error.is_connect() {
        "connection_error"
    } else if error.is_body() {
        "response_body_error"
    } else if error.is_decode() {
        "response_decode_error"
    } else if error.is_redirect() {
        "redirect_error"
    } else if error.is_builder() {
        "request_build_error"
    } else if error.is_status() {
        "http_status_error"
    } else {
        "request_error"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn response_error_keeps_only_safe_oauth_code() {
        let error = XaiOAuthError::response(
            400,
            br#"{"error":"invalid_grant","error_description":"secret refresh token"}"#,
        );
        assert!(error.is_invalid_grant());
        assert_eq!(
            error.to_string(),
            "xAI OAuth request failed with status 400 (invalid_grant)."
        );
        assert!(!error.to_string().contains("secret"));
    }

    #[test]
    fn response_error_rejects_unstructured_error_values() {
        let error = XaiOAuthError::response(500, br#"{"error":"token=secret value"}"#);
        assert_eq!(
            error.to_string(),
            "xAI OAuth request failed with status 500 (unknown_error)."
        );
    }

    #[test]
    fn response_error_rejects_unknown_but_well_formed_error_values() {
        let error = XaiOAuthError::response(400, br#"{"error":"secret_marker"}"#);
        assert_eq!(
            error.to_string(),
            "xAI OAuth request failed with status 400 (unknown_error)."
        );
        assert!(!error.to_string().contains("secret_marker"));
    }

    #[test]
    fn response_error_keeps_known_xai_refresh_codes() {
        let error = XaiOAuthError::response(400, br#"{"error":"app_session_terminated"}"#);
        assert!(error.is_invalid_grant());
        assert_eq!(
            error.to_string(),
            "xAI OAuth request failed with status 400 (app_session_terminated)."
        );
    }

    #[tokio::test]
    async fn request_error_does_not_expose_url_or_query() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind closed endpoint");
        let address = listener.local_addr().expect("closed endpoint address");
        drop(listener);
        let secret = "refresh-token-secret";
        let request_error = reqwest::Client::new()
            .get(format!(
                "http://{address}/oauth2/token?refresh_token={secret}"
            ))
            .send()
            .await
            .expect_err("closed endpoint should fail");

        let error = XaiOAuthError::request("refresh request", request_error).to_string();

        assert!(error.starts_with("xAI OAuth refresh request failed ("));
        assert!(!error.contains(secret));
        assert!(!error.contains(&address.to_string()));
        assert!(!error.contains("refresh_token"));
    }
}
