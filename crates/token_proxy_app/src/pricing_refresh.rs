use reqwest::header::{ETAG, IF_NONE_MATCH};
use std::time::Duration;
use token_proxy_account_store::oauth_util::build_reqwest_client;
use token_proxy_account_store::paths::TokenProxyPaths;

use token_proxy_storage::pricing::{
    read_remote_catalog_etag, store_remote_catalog, RemoteCatalogRefresh,
};

pub const REMOTE_PRICING_CATALOG_URL: &str =
    "https://raw.githubusercontent.com/mxyhi/token_proxy/main/crates/token_proxy_storage/resources/model-pricing.json";

/// 拉取远端价格目录；校验、持久化和历史成本回填由 storage 负责。
pub(crate) async fn refresh_remote_model_pricing_catalog(
    paths: &TokenProxyPaths,
    proxy_url: Option<&str>,
) -> Result<RemoteCatalogRefresh, String> {
    let pool = token_proxy_storage::sqlite::open_write_pool(&paths.sqlite_db_path()).await?;
    let url = REMOTE_PRICING_CATALOG_URL;
    let etag = read_remote_catalog_etag(&pool).await?;
    let client = build_reqwest_client(proxy_url, Duration::from_secs(15))?;
    let mut request = client.get(url);
    if let Some(etag) = etag.as_deref() {
        request = request.header(IF_NONE_MATCH, etag);
    }
    let response = request
        .send()
        .await
        .map_err(|err| format!("Failed to refresh model pricing catalog: {err}"))?;
    if response.status() == reqwest::StatusCode::NOT_MODIFIED {
        tracing::debug!(url, "model pricing catalog not modified");
        return Ok(RemoteCatalogRefresh::NotModified);
    }
    if !response.status().is_success() {
        return Err(format!(
            "Model pricing catalog returned HTTP {}.",
            response.status()
        ));
    }
    let response_etag = response
        .headers()
        .get(ETAG)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let catalog_json = response
        .text()
        .await
        .map_err(|err| format!("Failed to read model pricing catalog: {err}"))?;
    let refreshed = store_remote_catalog(&pool, &catalog_json, response_etag.as_deref()).await?;
    tracing::info!(url, "model pricing catalog refresh completed");
    Ok(refreshed)
}
