use std::collections::HashMap;
use std::sync::Arc;
use time::OffsetDateTime;
use tokio::sync::RwLock;
use tokio::task::AbortHandle;

use token_proxy_account_store::app_proxy::AppProxyState;
use token_proxy_account_store::oauth_util::{expires_at_from_seconds, generate_state, now_rfc3339};

use super::oauth::{XaiDeviceCode, XaiDevicePoll, XaiOAuthClient, XaiTokenResponse};
use super::store::XaiAccountStore;
use super::types::{
    XaiAccountStatus, XaiAccountSummary, XaiLoginPollResponse, XaiLoginStartResponse,
    XaiLoginStatus, XaiQuotaCache, XaiTokenRecord,
};

const DEFAULT_POLL_INTERVAL_SECONDS: u64 = 5;
const SLOW_DOWN_INCREMENT_SECONDS: u64 = 5;
const MAX_LOGIN_SECONDS: i64 = 30 * 60;
#[cfg(not(test))]
const TERMINAL_SESSION_RETENTION: std::time::Duration = std::time::Duration::from_secs(60);
#[cfg(test)]
const TERMINAL_SESSION_RETENTION: std::time::Duration = std::time::Duration::from_millis(10);

#[derive(Clone)]
pub struct XaiLoginManager {
    store: Arc<XaiAccountStore>,
    sessions: Arc<RwLock<HashMap<String, LoginSession>>>,
    app_proxy: AppProxyState,
}

#[derive(Clone)]
struct LoginSession {
    status: XaiLoginStatus,
    error: Option<String>,
    account: Option<XaiAccountSummary>,
    expires_at: OffsetDateTime,
    saving_account: bool,
    task_abort: Option<AbortHandle>,
}

enum AccountSaveClaim {
    Acquired,
    Inactive,
    Expired,
}

impl XaiLoginManager {
    pub fn new(store: Arc<XaiAccountStore>, app_proxy: AppProxyState) -> Self {
        Self {
            store,
            sessions: Arc::new(RwLock::new(HashMap::new())),
            app_proxy,
        }
    }

    pub async fn start_login(&self) -> Result<XaiLoginStartResponse, String> {
        let state = generate_state("xai")?;
        let proxy_url = self.app_proxy.read().await.clone();
        let client = XaiOAuthClient::new(proxy_url.as_deref())?;
        let device = client
            .start_device_flow()
            .await
            .map_err(|error| error.to_string())?;
        let expires_in = device.expires_in.clamp(1, MAX_LOGIN_SECONDS);
        let expires_at = OffsetDateTime::now_utc() + time::Duration::seconds(expires_in);
        self.sessions.write().await.insert(
            state.clone(),
            LoginSession {
                status: XaiLoginStatus::Waiting,
                error: None,
                account: None,
                expires_at,
                saving_account: false,
                task_abort: None,
            },
        );

        let manager = self.clone();
        let task_state = state.clone();
        let task_device = device.clone();
        let task = tokio::spawn(async move {
            manager
                .run_device_login(task_state, client, task_device, expires_at)
                .await;
        });
        let task_abort = task.abort_handle();
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(&state) {
            session.task_abort = Some(task_abort);
        } else {
            task_abort.abort();
        }
        tracing::info!("xai device login session started");

        Ok(XaiLoginStartResponse {
            state,
            user_code: device.user_code,
            verification_uri: device.verification_uri,
            verification_uri_complete: device.verification_uri_complete,
            interval_seconds: device.interval.max(DEFAULT_POLL_INTERVAL_SECONDS),
            expires_at: Some(expires_at_from_seconds(expires_in)),
        })
    }

    pub async fn poll_login(&self, state: &str) -> Result<XaiLoginPollResponse, String> {
        let mut sessions = self.sessions.write().await;
        let response = {
            let session = sessions
                .get_mut(state)
                .ok_or_else(|| "xAI login session not found.".to_string())?;
            if matches!(session.status, XaiLoginStatus::Waiting)
                && !session.saving_account
                && OffsetDateTime::now_utc() >= session.expires_at
            {
                session.status = XaiLoginStatus::Error;
                session.error = Some("xAI device login expired.".to_string());
            }
            XaiLoginPollResponse {
                state: state.to_string(),
                status: session.status.clone(),
                error: session.error.clone(),
                account: session.account.clone(),
            }
        };
        if !matches!(response.status, XaiLoginStatus::Waiting) {
            sessions.remove(state);
            tracing::debug!("xai device login terminal session consumed");
        }
        Ok(response)
    }

    pub async fn logout(&self, account_id: &str) -> Result<(), String> {
        self.store.delete_account(account_id).await
    }

    /// 取消是幂等操作；session 已结束或已消费时同样返回成功。
    pub async fn cancel_login(&self, state: &str) -> Result<(), String> {
        let task_abort = {
            let mut sessions = self.sessions.write().await;
            if sessions
                .get(state)
                .is_some_and(|session| session.saving_account)
            {
                return Err(
                    "xAI device login is already completing and cannot be cancelled.".to_string(),
                );
            }
            sessions
                .remove(state)
                .and_then(|session| session.task_abort)
        };
        if let Some(task_abort) = task_abort {
            task_abort.abort();
            tracing::info!("xai device login session cancelled");
        }
        Ok(())
    }

    async fn run_device_login(
        &self,
        state: String,
        client: XaiOAuthClient,
        device: XaiDeviceCode,
        deadline: OffsetDateTime,
    ) {
        let mut interval = device.interval.max(DEFAULT_POLL_INTERVAL_SECONDS);
        loop {
            let now = OffsetDateTime::now_utc();
            if !self.is_waiting_session(&state).await {
                tracing::debug!(
                    "xai device login task stopped because session is no longer active"
                );
                return;
            }
            if now >= deadline {
                self.fail_session(&state, "xAI device login expired.".to_string())
                    .await;
                return;
            }
            let poll = client.poll_device_code(&device).await;
            if !self.is_waiting_session(&state).await {
                tracing::debug!("xai device login result discarded after session cancellation");
                return;
            }
            // 网络轮询可能跨过 device-code 截止时间；过期响应不得再落库。
            if device_poll_expired(OffsetDateTime::now_utc(), deadline) {
                self.fail_session(&state, "xAI device login expired.".to_string())
                    .await;
                return;
            }
            match poll {
                Ok(XaiDevicePoll::Pending) => {}
                Ok(XaiDevicePoll::SlowDown) => {
                    interval = interval.saturating_add(SLOW_DOWN_INCREMENT_SECONDS);
                }
                Ok(XaiDevicePoll::Authorized(token)) => {
                    match self.claim_account_save(&state, deadline).await {
                        AccountSaveClaim::Acquired => {}
                        AccountSaveClaim::Inactive => {
                            tracing::debug!(
                                "xai authorized login discarded because session is no longer active"
                            );
                            return;
                        }
                        AccountSaveClaim::Expired => {
                            self.fail_session(&state, "xAI device login expired.".to_string())
                                .await;
                            return;
                        }
                    }
                    match self.save_token(&device, token).await {
                        Ok(account) => {
                            tracing::info!(
                                account_id = account.account_id,
                                "xai device login completed"
                            );
                            self.complete_session(&state, account).await;
                        }
                        Err(error) => self.fail_session(&state, error).await,
                    }
                    return;
                }
                Err(error) => {
                    self.fail_session(&state, error.to_string()).await;
                    return;
                }
            }
            let Some(sleep_duration) =
                device_poll_sleep_duration(OffsetDateTime::now_utc(), deadline, interval)
            else {
                self.fail_session(&state, "xAI device login expired.".to_string())
                    .await;
                return;
            };
            tokio::time::sleep(sleep_duration).await;
        }
    }

    async fn is_waiting_session(&self, state: &str) -> bool {
        self.sessions
            .read()
            .await
            .get(state)
            .is_some_and(|session| matches!(session.status, XaiLoginStatus::Waiting))
    }

    /// 与 cancel_login 共用 session 写锁，明确“可取消”和“正在提交账户”的先后顺序。
    async fn claim_account_save(&self, state: &str, deadline: OffsetDateTime) -> AccountSaveClaim {
        let mut sessions = self.sessions.write().await;
        let Some(session) = sessions.get_mut(state) else {
            return AccountSaveClaim::Inactive;
        };
        if !matches!(session.status, XaiLoginStatus::Waiting) || session.saving_account {
            return AccountSaveClaim::Inactive;
        }
        let now = OffsetDateTime::now_utc();
        if device_poll_expired(now, deadline) || now >= session.expires_at {
            return AccountSaveClaim::Expired;
        }
        session.saving_account = true;
        AccountSaveClaim::Acquired
    }

    async fn save_token(
        &self,
        device: &XaiDeviceCode,
        token: XaiTokenResponse,
    ) -> Result<XaiAccountSummary, String> {
        let record = XaiTokenRecord {
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            id_token: token.id_token,
            token_type: if token.token_type.trim().is_empty() {
                "Bearer".to_string()
            } else {
                token.token_type
            },
            expires_at: expires_at_from_seconds(token.expires_in),
            last_refresh: Some(now_rfc3339()),
            email: None,
            subject: None,
            token_endpoint: Some(device.token_endpoint.clone()),
            auto_refresh_enabled: true,
            status: XaiAccountStatus::Active,
            proxy_url: None,
            priority: 0,
            quota: XaiQuotaCache::default(),
        };
        self.store.save_new_account(record).await
    }

    async fn complete_session(&self, state: &str, account: XaiAccountSummary) {
        let updated = if let Some(session) = self.sessions.write().await.get_mut(state) {
            session.status = XaiLoginStatus::Success;
            session.error = None;
            session.account = Some(account);
            session.saving_account = false;
            true
        } else {
            false
        };
        if updated {
            self.schedule_terminal_session_cleanup(state.to_string());
        }
    }

    async fn fail_session(&self, state: &str, error: String) {
        tracing::warn!(reason = %error, "xai device login failed");
        let updated = if let Some(session) = self.sessions.write().await.get_mut(state) {
            session.status = XaiLoginStatus::Error;
            session.error = Some(error);
            session.account = None;
            session.saving_account = false;
            true
        } else {
            false
        };
        if updated {
            self.schedule_terminal_session_cleanup(state.to_string());
        }
    }

    fn schedule_terminal_session_cleanup(&self, state: String) {
        let sessions = Arc::clone(&self.sessions);
        tokio::spawn(async move {
            tokio::time::sleep(TERMINAL_SESSION_RETENTION).await;
            let removed = {
                let mut sessions = sessions.write().await;
                let terminal = sessions
                    .get(&state)
                    .is_some_and(|session| !matches!(session.status, XaiLoginStatus::Waiting));
                terminal && sessions.remove(&state).is_some()
            };
            if removed {
                tracing::debug!("xai device login terminal session retention expired");
            }
        });
    }
}

fn device_poll_sleep_duration(
    now: OffsetDateTime,
    deadline: OffsetDateTime,
    interval_seconds: u64,
) -> Option<std::time::Duration> {
    let remaining = std::time::Duration::try_from(deadline - now).ok()?;
    (!remaining.is_zero()).then(|| remaining.min(std::time::Duration::from_secs(interval_seconds)))
}

fn device_poll_expired(now: OffsetDateTime, deadline: OffsetDateTime) -> bool {
    now >= deadline
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };
    use token_proxy_account_store::app_proxy;
    use token_proxy_account_store::paths::TokenProxyPaths;

    #[tokio::test]
    async fn successful_session_is_removed_after_terminal_poll() {
        let manager = test_manager();
        insert_waiting_session(&manager, "success", OffsetDateTime::now_utc()).await;
        manager.complete_session("success", test_account()).await;

        let response = manager.poll_login("success").await.unwrap();

        assert_eq!(response.status, XaiLoginStatus::Success);
        assert_eq!(response.account.unwrap().account_id, "xai-test");
        assert!(manager.poll_login("success").await.is_err());
    }

    #[tokio::test]
    async fn failed_session_is_removed_when_terminal_result_is_not_polled() {
        let manager = test_manager();
        insert_waiting_session(&manager, "failure", OffsetDateTime::now_utc()).await;
        manager
            .fail_session("failure", "authorization denied".to_string())
            .await;

        tokio::time::sleep(TERMINAL_SESSION_RETENTION * 2).await;

        assert!(!manager.sessions.read().await.contains_key("failure"));
    }

    #[tokio::test]
    async fn expired_session_returns_error_once_then_is_removed() {
        let manager = test_manager();
        insert_waiting_session(
            &manager,
            "expired",
            OffsetDateTime::now_utc() - time::Duration::seconds(1),
        )
        .await;

        let response = manager.poll_login("expired").await.unwrap();

        assert_eq!(response.status, XaiLoginStatus::Error);
        assert_eq!(response.error.as_deref(), Some("xAI device login expired."));
        assert!(manager.poll_login("expired").await.is_err());
    }

    #[tokio::test]
    async fn cancel_login_is_idempotent_and_aborts_background_task() {
        let manager = test_manager();
        let completed = Arc::new(AtomicBool::new(false));
        let task_completed = completed.clone();
        let task = tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            task_completed.store(true, Ordering::SeqCst);
        });
        manager.sessions.write().await.insert(
            "cancelled".to_string(),
            LoginSession {
                status: XaiLoginStatus::Waiting,
                error: None,
                account: None,
                expires_at: OffsetDateTime::now_utc() + time::Duration::minutes(1),
                saving_account: false,
                task_abort: Some(task.abort_handle()),
            },
        );

        manager.cancel_login("cancelled").await.unwrap();
        manager.cancel_login("cancelled").await.unwrap();
        tokio::task::yield_now().await;

        assert!(!manager.sessions.read().await.contains_key("cancelled"));
        assert!(task.await.unwrap_err().is_cancelled());
        assert!(!completed.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn cancel_login_is_rejected_after_account_save_is_claimed() {
        let manager = test_manager();
        let deadline = OffsetDateTime::now_utc() + time::Duration::minutes(1);
        insert_waiting_session(&manager, "saving", deadline).await;

        assert!(matches!(
            manager.claim_account_save("saving", deadline).await,
            AccountSaveClaim::Acquired
        ));
        let error = manager
            .cancel_login("saving")
            .await
            .expect_err("committing account must no longer report a successful cancellation");

        assert!(error.contains("already completing"));
        assert!(manager.sessions.read().await.contains_key("saving"));
    }

    #[tokio::test]
    async fn successful_cancel_prevents_account_save_from_being_claimed() {
        let manager = test_manager();
        let deadline = OffsetDateTime::now_utc() + time::Duration::minutes(1);
        insert_waiting_session(&manager, "cancel-before-save", deadline).await;

        manager.cancel_login("cancel-before-save").await.unwrap();

        assert!(matches!(
            manager
                .claim_account_save("cancel-before-save", deadline)
                .await,
            AccountSaveClaim::Inactive
        ));
    }

    #[tokio::test]
    async fn poll_does_not_expire_session_while_account_save_is_in_progress() {
        let manager = test_manager();
        insert_waiting_session(
            &manager,
            "saving-expired",
            OffsetDateTime::now_utc() - time::Duration::seconds(1),
        )
        .await;
        manager
            .sessions
            .write()
            .await
            .get_mut("saving-expired")
            .expect("saving session")
            .saving_account = true;

        let response = manager.poll_login("saving-expired").await.unwrap();

        assert_eq!(response.status, XaiLoginStatus::Waiting);
        assert!(manager.sessions.read().await.contains_key("saving-expired"));
    }

    #[test]
    fn poll_sleep_is_clamped_to_remaining_deadline() {
        let now = OffsetDateTime::UNIX_EPOCH;
        assert_eq!(
            device_poll_sleep_duration(now, now + time::Duration::seconds(2), 30),
            Some(std::time::Duration::from_secs(2))
        );
        assert_eq!(device_poll_sleep_duration(now, now, 30), None);
    }

    #[test]
    fn poll_result_crossing_deadline_is_expired() {
        let deadline = OffsetDateTime::UNIX_EPOCH + time::Duration::seconds(10);

        assert!(!device_poll_expired(
            deadline - time::Duration::nanoseconds(1),
            deadline
        ));
        assert!(device_poll_expired(deadline, deadline));
        assert!(device_poll_expired(
            deadline + time::Duration::nanoseconds(1),
            deadline
        ));
    }

    fn test_manager() -> XaiLoginManager {
        let app_proxy = app_proxy::new_state();
        let paths = TokenProxyPaths::from_config_path(
            std::env::temp_dir().join("token-proxy-xai-login-test/config.jsonc"),
        )
        .unwrap();
        let store = Arc::new(XaiAccountStore::new(&paths, Arc::clone(&app_proxy)).unwrap());
        XaiLoginManager::new(store, app_proxy)
    }

    async fn insert_waiting_session(
        manager: &XaiLoginManager,
        state: &str,
        expires_at: OffsetDateTime,
    ) {
        manager.sessions.write().await.insert(
            state.to_string(),
            LoginSession {
                status: XaiLoginStatus::Waiting,
                error: None,
                account: None,
                expires_at,
                saving_account: false,
                task_abort: None,
            },
        );
    }

    fn test_account() -> XaiAccountSummary {
        XaiAccountSummary {
            account_id: "xai-test".to_string(),
            email: Some("test@example.com".to_string()),
            expires_at: Some("2999-01-01T00:00:00Z".to_string()),
            status: XaiAccountStatus::Active,
            auto_refresh_enabled: true,
            proxy_url: None,
            priority: 0,
        }
    }
}
