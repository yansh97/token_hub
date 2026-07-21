//! xAI OAuth 账户的 Tauri command 边界。
//!
//! 凭证解析、网络 I/O 与持久化均由 core Store/LoginManager 负责；这里仅做参数校验、
//! 状态注入和不含敏感信息的操作日志，避免 token 进入桌面端日志。

use std::path::PathBuf;
use std::sync::Arc;

use crate::commands::parse_manual_account_status;
use crate::xai;

#[tauri::command]
pub async fn xai_list_accounts(
    xai_store: tauri::State<'_, Arc<xai::XaiAccountStore>>,
) -> Result<Vec<xai::XaiAccountSummary>, String> {
    xai_store.list_accounts().await
}

#[tauri::command]
pub async fn xai_import_file(
    xai_store: tauri::State<'_, Arc<xai::XaiAccountStore>>,
    path: String,
) -> Result<Vec<xai::XaiAccountSummary>, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Import path is required.".to_string());
    }
    let accounts = xai_store.import_file(PathBuf::from(trimmed)).await?;
    tracing::info!(
        imported = accounts.len(),
        "xai account file import command completed"
    );
    Ok(accounts)
}

#[tauri::command]
pub async fn xai_import_text(
    xai_store: tauri::State<'_, Arc<xai::XaiAccountStore>>,
    contents: String,
) -> Result<Vec<xai::XaiAccountSummary>, String> {
    let accounts = xai_store.import_text(&contents).await?;
    tracing::info!(
        imported = accounts.len(),
        "xai account text import command completed"
    );
    Ok(accounts)
}

#[tauri::command]
pub async fn xai_import_refresh_tokens(
    xai_store: tauri::State<'_, Arc<xai::XaiAccountStore>>,
    contents: String,
) -> Result<Vec<xai::XaiAccountSummary>, String> {
    let accounts = xai_store.import_refresh_tokens(&contents).await?;
    tracing::info!(
        imported = accounts.len(),
        "xai refresh token import command completed"
    );
    Ok(accounts)
}

#[tauri::command]
pub async fn xai_fetch_quotas(
    xai_store: tauri::State<'_, Arc<xai::XaiAccountStore>>,
) -> Result<Vec<xai::XaiQuotaSummary>, String> {
    xai::fetch_quotas(xai_store.as_ref()).await
}

#[tauri::command]
pub async fn xai_refresh_quota_cache(
    xai_store: tauri::State<'_, Arc<xai::XaiAccountStore>>,
    account_ids: Option<Vec<String>>,
) -> Result<Vec<String>, String> {
    xai_store.refresh_quota_cache(account_ids.as_deref()).await
}

#[tauri::command]
pub async fn xai_refresh_quota_now(
    xai_store: tauri::State<'_, Arc<xai::XaiAccountStore>>,
    account_id: String,
) -> Result<(), String> {
    xai_store.refresh_quota_cache_now(&account_id).await?;
    tracing::info!(account_id, "xai quota refresh command completed");
    Ok(())
}

#[tauri::command]
pub async fn xai_refresh_account(
    xai_store: tauri::State<'_, Arc<xai::XaiAccountStore>>,
    account_id: String,
) -> Result<(), String> {
    xai_store.refresh_account(&account_id).await?;
    tracing::info!(account_id, "xai account refresh command completed");
    Ok(())
}

#[tauri::command]
pub async fn xai_set_auto_refresh(
    xai_store: tauri::State<'_, Arc<xai::XaiAccountStore>>,
    account_id: String,
    enabled: bool,
) -> Result<xai::XaiAccountSummary, String> {
    let account = xai_store.set_auto_refresh(&account_id, enabled).await?;
    tracing::info!(account_id, enabled, "xai account auto refresh updated");
    Ok(account)
}

#[tauri::command]
pub async fn xai_set_status(
    xai_store: tauri::State<'_, Arc<xai::XaiAccountStore>>,
    account_id: String,
    status: String,
) -> Result<xai::XaiAccountSummary, String> {
    let status = parse_manual_account_status(&status)?;
    let account = xai_store.set_status(&account_id, status.into()).await?;
    tracing::info!(account_id, status = ?account.status, "xai account status updated");
    Ok(account)
}

#[tauri::command]
pub async fn xai_set_proxy_url(
    xai_store: tauri::State<'_, Arc<xai::XaiAccountStore>>,
    account_id: String,
    proxy_url: Option<String>,
) -> Result<xai::XaiAccountSummary, String> {
    let account = xai_store
        .set_proxy_url(&account_id, proxy_url.as_deref())
        .await?;
    tracing::info!(
        account_id,
        proxy_enabled = account.proxy_url.is_some(),
        "xai account proxy updated"
    );
    Ok(account)
}

#[tauri::command]
pub async fn xai_set_priority(
    xai_store: tauri::State<'_, Arc<xai::XaiAccountStore>>,
    account_id: String,
    priority: i32,
) -> Result<xai::XaiAccountSummary, String> {
    let account = xai_store.set_priority(&account_id, priority).await?;
    tracing::info!(account_id, priority, "xai account priority updated");
    Ok(account)
}

#[tauri::command]
pub async fn xai_start_login(
    xai_login: tauri::State<'_, Arc<xai::XaiLoginManager>>,
) -> Result<xai::XaiLoginStartResponse, String> {
    xai_login.start_login().await
}

#[tauri::command]
pub async fn xai_poll_login(
    xai_login: tauri::State<'_, Arc<xai::XaiLoginManager>>,
    state: String,
) -> Result<xai::XaiLoginPollResponse, String> {
    xai_login.poll_login(&state).await
}

#[tauri::command]
pub async fn xai_cancel_login(
    xai_login: tauri::State<'_, Arc<xai::XaiLoginManager>>,
    state: String,
) -> Result<(), String> {
    let state = state.trim();
    if state.is_empty() {
        return Err("Login state is required.".to_string());
    }
    xai_login.cancel_login(state).await?;
    tracing::info!("xai device login cancel command completed");
    Ok(())
}

#[tauri::command]
pub async fn xai_logout(
    xai_login: tauri::State<'_, Arc<xai::XaiLoginManager>>,
    account_id: String,
) -> Result<(), String> {
    xai_login.logout(&account_id).await?;
    tracing::info!(account_id, "xai account deleted");
    Ok(())
}
