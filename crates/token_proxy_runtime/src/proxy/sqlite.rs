use sqlx::SqlitePool;
use token_proxy_account_store::paths::TokenProxyPaths;

#[cfg(test)]
pub use token_proxy_storage::sqlite::init_schema;

/// 将应用路径策略收敛成 storage 所需的具体数据库路径。
pub async fn open_write_pool(paths: &TokenProxyPaths) -> Result<SqlitePool, String> {
    token_proxy_storage::sqlite::open_write_pool(&paths.sqlite_db_path()).await
}
