use std::sync::Arc;

use tauri::Manager;

use crate::proxy;

#[tauri::command]
pub async fn read_dashboard_snapshot(
    app: tauri::AppHandle,
    proxy_service: tauri::State<'_, proxy::service::ProxyServiceHandle>,
    range: proxy::dashboard::DashboardRange,
    offset: Option<u32>,
    upstream_id: Option<String>,
    account_id: Option<String>,
    public_only: Option<bool>,
    model: Option<String>,
) -> Result<proxy::dashboard::DashboardSnapshot, String> {
    let paths = app.state::<Arc<token_proxy_core::paths::TokenProxyPaths>>();
    let pool = proxy::sqlite::open_read_pool(paths.inner().as_ref()).await?;
    tracing::debug!(
        upstream_id = upstream_id.as_deref(),
        account_id = account_id.as_deref(),
        public_only = public_only.unwrap_or(false),
        model = model.as_deref(),
        "read_dashboard_snapshot invoked"
    );
    let mut snapshot = proxy::dashboard::read_snapshot(
        &pool,
        range,
        offset,
        upstream_id,
        account_id,
        public_only.unwrap_or(false),
        model,
    )
    .await?;
    snapshot.model_probes = proxy_service.model_discovery_snapshot().await;
    Ok(snapshot)
}

#[tauri::command]
pub async fn refresh_dashboard_model_discovery(
    proxy_service: tauri::State<'_, proxy::service::ProxyServiceHandle>,
) -> Result<(), String> {
    let _ = proxy_service.refresh_model_discovery().await;
    Ok(())
}
