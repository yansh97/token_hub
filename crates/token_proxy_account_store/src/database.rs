//! SQLite infrastructure owned by provider accounts.

use sqlx::Row;
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
    SqlitePool,
};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;
use tokio::sync::{Mutex, OnceCell};

use crate::paths::TokenProxyPaths;

static ACCOUNT_POOLS: OnceCell<Mutex<HashMap<PathBuf, SqlitePool>>> = OnceCell::const_new();

/// Opens a cached write pool and initializes the account-owned schema.
pub async fn open_write_pool(paths: &TokenProxyPaths) -> Result<SqlitePool, String> {
    let pools = ACCOUNT_POOLS
        .get_or_init(|| async { Mutex::new(HashMap::new()) })
        .await;
    let db_path = paths.sqlite_db_path();
    let mut guard = pools.lock().await;
    if let Some(pool) = guard.get(&db_path) {
        return Ok(pool.clone());
    }
    if let Some(parent) = db_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|error| format!("Failed to create db directory: {error}"))?;
    }
    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(Duration::from_secs(5));
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .map_err(|error| format!("Failed to connect sqlite: {error}"))?;
    init_schema(&pool).await?;
    guard.insert(db_path, pool.clone());
    Ok(pool)
}

/// Account reads share the same WAL pool; serialization keeps migrations and
/// mutations ordered without creating another per-path pool cache.
pub async fn open_read_pool(paths: &TokenProxyPaths) -> Result<SqlitePool, String> {
    open_write_pool(paths).await
}

/// Initializes and migrates the provider-account projection.
pub async fn init_schema(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        r#"
CREATE TABLE IF NOT EXISTS provider_accounts (
  provider_kind TEXT NOT NULL,
  account_id TEXT PRIMARY KEY,
  email TEXT,
  expires_at TEXT,
  expires_at_ms INTEGER,
  auth_method TEXT,
  provider_name TEXT,
  record_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0
);
"#,
    )
    .execute(pool)
    .await
    .map_err(|error| format!("Failed to create provider_accounts table: {error}"))?;

    ensure_columns(pool).await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_provider_accounts_kind_account_id ON provider_accounts(provider_kind, account_id);",
    )
    .execute(pool)
    .await
    .map_err(|error| format!("Failed to create provider account kind index: {error}"))?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_provider_accounts_email ON provider_accounts(email);",
    )
    .execute(pool)
    .await
    .map_err(|error| format!("Failed to create provider account email index: {error}"))?;
    sqlx::query("DROP TABLE IF EXISTS account_state_logs;")
        .execute(pool)
        .await
        .map_err(|error| format!("Failed to drop legacy account_state_logs table: {error}"))?;
    migrate_status(pool).await
}

async fn ensure_columns(pool: &SqlitePool) -> Result<(), String> {
    let columns = sqlx::query("PRAGMA table_info(provider_accounts);")
        .fetch_all(pool)
        .await
        .map_err(|error| format!("Failed to read provider_accounts schema: {error}"))?
        .into_iter()
        .filter_map(|row| row.try_get::<String, _>("name").ok())
        .collect::<std::collections::HashSet<_>>();
    if !columns.contains("priority") {
        sqlx::query(
            "ALTER TABLE provider_accounts ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;",
        )
        .execute(pool)
        .await
        .map_err(|error| format!("Failed to add priority column: {error}"))?;
    }
    Ok(())
}

async fn migrate_status(pool: &SqlitePool) -> Result<(), String> {
    let rows = sqlx::query("SELECT account_id, record_json FROM provider_accounts;")
        .fetch_all(pool)
        .await
        .map_err(|error| {
            format!("Failed to read provider_accounts for status migration: {error}")
        })?;
    if rows.is_empty() {
        return Ok(());
    }
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("Failed to begin provider_accounts migration: {error}"))?;
    for row in rows {
        let account_id = row
            .try_get::<String, _>("account_id")
            .map_err(|error| format!("Failed to decode provider account id: {error}"))?;
        let record_json = row
            .try_get::<String, _>("record_json")
            .map_err(|error| format!("Failed to decode provider account record: {error}"))?;
        let mut value = serde_json::from_str::<serde_json::Value>(&record_json)
            .map_err(|error| format!("Failed to parse provider account {account_id}: {error}"))?;
        let Some(object) = value.as_object_mut() else {
            continue;
        };
        if !object.contains_key("status") {
            let status = if object
                .get("enabled")
                .and_then(serde_json::Value::as_bool)
                .is_some_and(|enabled| !enabled)
            {
                "disabled"
            } else {
                "active"
            };
            object.insert(
                "status".to_string(),
                serde_json::Value::String(status.to_string()),
            );
        }
        object.remove("enabled");
        let priority = object
            .get("priority")
            .and_then(serde_json::Value::as_i64)
            .and_then(|value| i32::try_from(value).ok())
            .unwrap_or(0);
        object.insert(
            "priority".to_string(),
            serde_json::Value::Number(serde_json::Number::from(priority)),
        );
        let next_record_json = serde_json::to_string(&value).map_err(|error| {
            format!("Failed to serialize provider account {account_id}: {error}")
        })?;
        sqlx::query(
            "UPDATE provider_accounts SET record_json = ?, priority = ? WHERE account_id = ?;",
        )
        .bind(next_record_json)
        .bind(priority)
        .bind(account_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| format!("Failed to migrate provider account row: {error}"))?;
    }
    transaction
        .commit()
        .await
        .map_err(|error| format!("Failed to commit provider_accounts migration: {error}"))
}
