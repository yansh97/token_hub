//! Application composition root shared by CLI and Tauri adapters.

use std::sync::Arc;

use token_proxy_account_codex::{CodexAccountStore, CodexLoginManager};
use token_proxy_account_kiro::{KiroAccountStore, KiroLoginManager};
use token_proxy_account_store::app_proxy::{self, AppProxyState};
use token_proxy_account_store::paths::TokenProxyPaths;
use token_proxy_account_xai::{XaiAccountStore, XaiLoginManager};

use crate::{
    logging::LoggingState,
    proxy::{
        request_detail::{RequestDetailCapture, RequestDetailCaptureState},
        service::{ProxyContext, ProxyServiceHandle},
        token_rate::TokenRateTracker,
    },
};

pub type RequestDetailChangeHandler = Arc<dyn Fn(RequestDetailCaptureState) + Send + Sync>;

/// Fully composed application services. Adapters may register the returned
/// handles in their own state container, but they do not construct internals.
#[derive(Clone)]
pub struct TokenProxyApp {
    paths: Arc<TokenProxyPaths>,
    logging: LoggingState,
    app_proxy: AppProxyState,
    request_detail: Arc<RequestDetailCapture>,
    token_rate: Arc<TokenRateTracker>,
    kiro_accounts: Arc<KiroAccountStore>,
    codex_accounts: Arc<CodexAccountStore>,
    xai_accounts: Arc<XaiAccountStore>,
    kiro_login: Arc<KiroLoginManager>,
    codex_login: Arc<CodexLoginManager>,
    xai_login: Arc<XaiLoginManager>,
    proxy: ProxyServiceHandle,
    proxy_context: ProxyContext,
}

impl TokenProxyApp {
    /// Composes one application instance around a single data directory.
    pub fn open(
        paths: TokenProxyPaths,
        logging: LoggingState,
        on_request_detail_change: Option<RequestDetailChangeHandler>,
    ) -> Result<Self, String> {
        let paths = Arc::new(paths);
        let app_proxy = app_proxy::new_state();
        let request_detail = Arc::new(RequestDetailCapture::new(on_request_detail_change));
        let token_rate = TokenRateTracker::new();
        let kiro_accounts = Arc::new(KiroAccountStore::new(&paths, app_proxy.clone())?);
        let codex_accounts = Arc::new(CodexAccountStore::new(&paths, app_proxy.clone())?);
        let xai_accounts = Arc::new(XaiAccountStore::new(&paths, app_proxy.clone())?);
        let kiro_login = Arc::new(KiroLoginManager::new(
            kiro_accounts.clone(),
            app_proxy.clone(),
        ));
        let codex_login = Arc::new(CodexLoginManager::new(
            codex_accounts.clone(),
            app_proxy.clone(),
        ));
        let xai_login = Arc::new(XaiLoginManager::new(
            xai_accounts.clone(),
            app_proxy.clone(),
        ));
        let proxy = ProxyServiceHandle::new();
        let proxy_context = ProxyContext {
            paths: paths.clone(),
            logging: logging.clone(),
            request_detail: request_detail.clone(),
            token_rate: token_rate.clone(),
            kiro_accounts: kiro_accounts.clone(),
            codex_accounts: codex_accounts.clone(),
            xai_accounts: xai_accounts.clone(),
        };
        tracing::debug!(data_dir = %paths.data_dir().display(), "token proxy app composed");
        Ok(Self {
            paths,
            logging,
            app_proxy,
            request_detail,
            token_rate,
            kiro_accounts,
            codex_accounts,
            xai_accounts,
            kiro_login,
            codex_login,
            xai_login,
            proxy,
            proxy_context,
        })
    }

    pub fn paths(&self) -> Arc<TokenProxyPaths> {
        self.paths.clone()
    }

    pub fn logging(&self) -> LoggingState {
        self.logging.clone()
    }

    pub fn app_proxy(&self) -> AppProxyState {
        self.app_proxy.clone()
    }

    pub fn request_detail(&self) -> Arc<RequestDetailCapture> {
        self.request_detail.clone()
    }

    pub fn token_rate(&self) -> Arc<TokenRateTracker> {
        self.token_rate.clone()
    }

    pub fn kiro_accounts(&self) -> Arc<KiroAccountStore> {
        self.kiro_accounts.clone()
    }

    pub fn codex_accounts(&self) -> Arc<CodexAccountStore> {
        self.codex_accounts.clone()
    }

    pub fn xai_accounts(&self) -> Arc<XaiAccountStore> {
        self.xai_accounts.clone()
    }

    pub fn kiro_login(&self) -> Arc<KiroLoginManager> {
        self.kiro_login.clone()
    }

    pub fn codex_login(&self) -> Arc<CodexLoginManager> {
        self.codex_login.clone()
    }

    pub fn xai_login(&self) -> Arc<XaiLoginManager> {
        self.xai_login.clone()
    }

    pub fn proxy(&self) -> ProxyServiceHandle {
        self.proxy.clone()
    }

    pub fn proxy_context(&self) -> ProxyContext {
        self.proxy_context.clone()
    }
}
