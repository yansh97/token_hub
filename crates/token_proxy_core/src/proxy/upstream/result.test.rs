use super::*;
use crate::proxy::account_selector::AccountSelectorRuntime;

#[test]
fn xai_free_usage_hint_applies_explicit_cooldown_when_default_is_disabled() {
    let selector = AccountSelectorRuntime::new_with_cooldown(std::time::Duration::ZERO);
    let mut response = http::error_response(StatusCode::OK, "free usage exhausted");
    response.extensions_mut().insert(AccountCooldownHint {
        duration: std::time::Duration::from_secs(24 * 60 * 60),
        reason: "free_usage_exhausted",
    });

    update_account_cooldown_from_response(
        &selector,
        "xai",
        Some("xai-a"),
        StatusCode::TOO_MANY_REQUESTS,
        &reqwest::header::HeaderMap::new(),
        &response,
        &CooldownScope::Global,
    );

    let ordered =
        selector.order_accounts_scoped("xai", &["xai-a".to_string()], &CooldownScope::Global);
    assert!(ordered.is_empty());
}
