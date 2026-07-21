//! xAI mapping onto provider-independent account records.

use std::collections::HashMap;

use token_proxy_account_store::paths::TokenProxyPaths;
use token_proxy_account_store::records::{self, AccountRecordMetadata, ProviderKind};

use crate::types::XaiTokenRecord;

pub async fn upsert_xai_account(
    paths: &TokenProxyPaths,
    account_id: &str,
    record: &XaiTokenRecord,
) -> Result<(), String> {
    records::upsert_record(
        paths,
        ProviderKind::Xai,
        AccountRecordMetadata {
            account_id,
            email: record.email.as_deref(),
            expires_at: Some(record.expires_at.as_str()),
            expires_at_ms: record.expires_at().map(records::unix_millis),
            auth_method: Some("oauth"),
            provider_name: Some("xai"),
            priority: record.priority,
        },
        record,
    )
    .await
}

pub async fn list_xai_records(
    paths: &TokenProxyPaths,
) -> Result<HashMap<String, XaiTokenRecord>, String> {
    records::list_records(paths, ProviderKind::Xai).await
}

pub async fn delete_account(paths: &TokenProxyPaths, account_id: &str) -> Result<(), String> {
    records::delete_record(paths, ProviderKind::Xai, account_id).await
}
