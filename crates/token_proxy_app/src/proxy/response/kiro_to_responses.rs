use super::super::log::UsageSnapshot;
use super::kiro_to_responses_helpers::{
    apply_usage_fallback, usage_from_kiro, usage_json_from_kiro,
};
use axum::body::Bytes;

pub(super) fn extract_kiro_usage_snapshot(
    bytes: &Bytes,
    model: Option<&str>,
    estimated_input_tokens: Option<u64>,
) -> Option<UsageSnapshot> {
    let parsed = crate::proxy::kiro::parse_event_stream(bytes).ok()?;
    let mut usage = parsed.usage.clone();
    apply_usage_fallback(
        &mut usage,
        model,
        estimated_input_tokens,
        &parsed.content,
        &parsed.reasoning,
    );
    let usage_snapshot =
        UsageSnapshot::from_uncached_usage(usage_from_kiro(&usage), usage_json_from_kiro(&usage));
    if usage_snapshot.is_empty() {
        return None;
    }
    Some(usage_snapshot)
}
