pub use token_proxy_account_store::app_proxy::{set, AppProxyState};

#[cfg(test)]
pub fn new_state() -> AppProxyState {
    token_proxy_account_store::app_proxy::new_state()
}
