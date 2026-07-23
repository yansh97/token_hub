//! Codex account OAuth, refresh, quota, state, and persistence behavior.

mod agent_identity;
mod error;
mod identity;
mod login;
mod oauth;
mod persistence;
mod quota;
mod store;
mod types;

pub use identity::{
    enforce_minimum_client_version, is_official_originator, official_originator_from_user_agent,
    supported_official_user_agent, DEFAULT_ORIGINATOR, USER_AGENT,
};
pub use login::CodexLoginManager;
pub use oauth::CodexRefreshTokenClient;
pub use quota::fetch_quotas;
pub use store::CodexAccountStore;
pub use types::{
    CodexAccountStatus, CodexAccountSummary, CodexAgentIdentityRef, CodexAuthMethod,
    CodexCredential, CodexLoginPollResponse, CodexLoginStartResponse, CodexOAuthCredentialRef,
    CodexQuotaCache, CodexQuotaItem, CodexQuotaSummary, CodexTokenRecord,
};
