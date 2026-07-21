use super::*;
use crate::proxy::response::RetryableStreamResponse;

#[test]
fn xai_failover_uses_stream_marker_semantic_status() {
    for status in [StatusCode::UNAUTHORIZED, StatusCode::TOO_MANY_REQUESTS] {
        let mut response = http::error_response(StatusCode::OK, "embedded stream failure");
        response.extensions_mut().insert(RetryableStreamResponse {
            status,
            message: "embedded stream failure".to_string(),
            should_cooldown: true,
        });
        let outcome = AttemptOutcome::Retryable {
            message: "embedded stream failure".to_string(),
            response: Some(response),
            is_timeout: false,
            should_cooldown: true,
            deferred_log: None,
        };

        assert!(should_failover_account_outcome("xai", &outcome));
    }
}

#[test]
fn xai_does_not_failover_for_non_retryable_stream_semantic_status() {
    let mut response = http::error_response(StatusCode::OK, "bad request");
    response.extensions_mut().insert(RetryableStreamResponse {
        status: StatusCode::BAD_REQUEST,
        message: "bad request".to_string(),
        should_cooldown: false,
    });
    let outcome = AttemptOutcome::Retryable {
        message: "bad request".to_string(),
        response: Some(response),
        is_timeout: false,
        should_cooldown: false,
        deferred_log: None,
    };

    assert!(!should_failover_account_outcome("xai", &outcome));
}
