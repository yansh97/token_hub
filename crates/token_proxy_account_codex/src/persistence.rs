//! Codex mapping onto provider-independent account records.

use std::collections::HashMap;

use token_proxy_account_store::paths::TokenProxyPaths;
use token_proxy_account_store::records::{self, AccountRecordMetadata, ProviderKind};

use crate::types::CodexTokenRecord;

pub async fn upsert_codex_account(
    paths: &TokenProxyPaths,
    account_id: &str,
    record: &CodexTokenRecord,
) -> Result<(), String> {
    records::upsert_record(
        paths,
        ProviderKind::Codex,
        AccountRecordMetadata {
            account_id,
            email: record.email.as_deref(),
            expires_at: Some(record.expires_at.as_str()),
            expires_at_ms: record.expires_at().map(records::unix_millis),
            auth_method: None,
            provider_name: None,
            priority: record.priority,
        },
        record,
    )
    .await
}

pub async fn list_codex_records(
    paths: &TokenProxyPaths,
) -> Result<HashMap<String, CodexTokenRecord>, String> {
    records::list_records(paths, ProviderKind::Codex).await
}

pub async fn delete_account(paths: &TokenProxyPaths, account_id: &str) -> Result<(), String> {
    records::delete_record(paths, ProviderKind::Codex, account_id).await
}
