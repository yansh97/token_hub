//! Codex mapping onto provider-independent account records.

use std::collections::HashMap;

use serde::Deserialize;
use token_proxy_account_store::paths::TokenProxyPaths;
use token_proxy_account_store::records::{self, AccountRecordMetadata, ProviderKind};

use crate::types::{CodexAccountStatus, CodexCredential, CodexQuotaCache, CodexTokenRecord};

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
            expires_at: record.expires_at_str(),
            expires_at_ms: record.expires_at().map(records::unix_millis),
            auth_method: Some(record.auth_method().as_str()),
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
    let raw_records =
        records::list_records::<serde_json::Value>(paths, ProviderKind::Codex).await?;
    let mut migrated = HashMap::with_capacity(raw_records.len());
    for (account_id, value) in raw_records {
        let (record, was_legacy) = match serde_json::from_value::<CodexTokenRecord>(value.clone()) {
            Ok(record) => (record, false),
            Err(canonical_error) => {
                let legacy = serde_json::from_value::<LegacyCodexTokenRecord>(value).map_err(|legacy_error| {
                    format!(
                        "Failed to deserialize Codex account {account_id}: canonical={canonical_error}; legacy={legacy_error}"
                    )
                })?;
                (legacy.into_canonical(), true)
            }
        };
        if was_legacy {
            // Persist the canonical shape immediately so legacy handling remains a one-time read migration.
            upsert_codex_account(paths, &account_id, &record).await?;
            tracing::info!(
                account_id,
                "codex oauth account migrated to canonical credential format"
            );
        }
        migrated.insert(account_id, record);
    }
    Ok(migrated)
}

pub async fn delete_account(paths: &TokenProxyPaths, account_id: &str) -> Result<(), String> {
    records::delete_record(paths, ProviderKind::Codex, account_id).await
}

#[derive(Deserialize)]
struct LegacyCodexTokenRecord {
    access_token: String,
    refresh_token: String,
    #[serde(default)]
    client_id: Option<String>,
    #[serde(default)]
    id_token: String,
    #[serde(default = "legacy_auto_refresh_enabled")]
    auto_refresh_enabled: bool,
    #[serde(default = "legacy_account_status")]
    status: CodexAccountStatus,
    account_id: Option<String>,
    #[serde(default)]
    user_id: Option<String>,
    #[serde(default)]
    openai_device_id: Option<String>,
    email: Option<String>,
    expires_at: String,
    last_refresh: Option<String>,
    #[serde(default)]
    proxy_url: Option<String>,
    #[serde(default)]
    priority: i32,
    #[serde(default)]
    quota: CodexQuotaCache,
}

impl LegacyCodexTokenRecord {
    fn into_canonical(self) -> CodexTokenRecord {
        CodexTokenRecord {
            credential: CodexCredential::Oauth {
                access_token: self.access_token,
                refresh_token: self.refresh_token,
                client_id: self.client_id,
                id_token: self.id_token,
                auto_refresh_enabled: self.auto_refresh_enabled,
                openai_device_id: self.openai_device_id,
                expires_at: self.expires_at,
                last_refresh: self.last_refresh,
            },
            status: self.status,
            account_id: self.account_id,
            user_id: self.user_id,
            email: self.email,
            proxy_url: self.proxy_url,
            priority: self.priority,
            quota: self.quota,
        }
    }
}

fn legacy_auto_refresh_enabled() -> bool {
    true
}

fn legacy_account_status() -> CodexAccountStatus {
    CodexAccountStatus::Active
}
