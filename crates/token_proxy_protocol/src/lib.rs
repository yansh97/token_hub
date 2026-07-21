//! Pure protocol contracts and transformations shared by every runtime adapter.
//!
//! Network transport, persistence, account state, and application config do
//! not belong here. Functions consume values or byte slices and return values.

pub mod codex_tool_types;
pub mod compat_content;
pub mod compat_reason;
pub mod request_token_estimate;
pub mod sse;
pub mod token_estimator;
