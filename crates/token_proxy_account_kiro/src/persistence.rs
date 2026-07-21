//! Kiro mapping onto provider-independent account records.

use std::collections::HashMap;

use token_proxy_account_store::paths::TokenProxyPaths;
use token_proxy_account_store::records::{self, AccountRecordMetadata, ProviderKind};

use crate::types::KiroTokenRecord;

pub async fn upsert_kiro_account(
    paths: &TokenProxyPaths,
    account_id: &str,
    record: &KiroTokenRecord,
) -> Result<(), String> {
    records::upsert_record(
        paths,
        ProviderKind::Kiro,
        AccountRecordMetadata {
            account_id,
            email: record.email.as_deref(),
            expires_at: Some(record.expires_at.as_str()),
            expires_at_ms: record.expires_at().map(records::unix_millis),
            auth_method: Some(record.auth_method.as_str()),
            provider_name: Some(record.provider.as_str()),
            priority: record.priority,
        },
        record,
    )
    .await
}

pub async fn list_kiro_records(
    paths: &TokenProxyPaths,
) -> Result<HashMap<String, KiroTokenRecord>, String> {
    records::list_records(paths, ProviderKind::Kiro).await
}

pub async fn delete_account(paths: &TokenProxyPaths, account_id: &str) -> Result<(), String> {
    records::delete_record(paths, ProviderKind::Kiro, account_id).await
}
