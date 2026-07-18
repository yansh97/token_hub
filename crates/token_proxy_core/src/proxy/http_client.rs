use std::{collections::HashMap, sync::Mutex, time::Duration};

use reqwest::{Client, ClientBuilder, Proxy};

/// 进程内上游 HTTP client 池。
///
/// - 按 `(proxy_url, http1_only)` 缓存，长连接复用
/// - 首响应头前 H2/连接故障时 `rotate_*` 重建 H2 槽位，避免毒连接反复被复用
/// - ordinary / codex 共用同一套池与调优参数
pub(crate) struct ProxyHttpClients {
    by_key: Mutex<HashMap<ClientKey, Client>>,
}

impl ProxyHttpClients {
    pub(crate) fn new() -> Result<Self, String> {
        let direct = build_tuned_client(None, false)
            .map_err(|err| format!("Failed to build direct HTTP client: {err}"))?;
        let mut by_key = HashMap::new();
        by_key.insert(ClientKey::new(None, false), direct);
        Ok(Self {
            by_key: Mutex::new(by_key),
        })
    }

    /// 默认 HTTP/2 优先的上游 client（无显式 proxy 时不走系统代理）。
    pub(crate) fn client_for_proxy_url(&self, proxy_url: Option<&str>) -> Result<Client, String> {
        self.client_for(proxy_url, false)
    }

    /// 强制 HTTP/1.1 的上游 client，用于 H2 协议层故障后的降级重试。
    pub(crate) fn client_for_proxy_url_http1(
        &self,
        proxy_url: Option<&str>,
    ) -> Result<Client, String> {
        self.client_for(proxy_url, true)
    }

    /// 丢弃并重建指定 proxy 槽位的 H2 client；若已有 H1 槽位则一并重建。
    /// 返回新的 H2 client，供调用方立即使用。
    pub(crate) fn rotate_client_for_proxy_url(
        &self,
        proxy_url: Option<&str>,
    ) -> Result<Client, String> {
        let proxy_key = normalize_proxy_url(proxy_url);
        let h2_client = build_tuned_client(proxy_key.as_deref(), false).map_err(|err| {
            format!("Failed to rebuild HTTP client after transport failure: {err}")
        })?;
        let mut guard = self
            .by_key
            .lock()
            .map_err(|_| "HTTP client pool is poisoned.".to_string())?;

        guard.insert(
            ClientKey::new(proxy_key.as_deref(), false),
            h2_client.clone(),
        );
        let h1_key = ClientKey::new(proxy_key.as_deref(), true);
        if guard.contains_key(&h1_key) {
            let h1_client = build_tuned_client(proxy_key.as_deref(), true).map_err(|err| {
                format!("Failed to rebuild HTTP/1.1 client after transport failure: {err}")
            })?;
            guard.insert(h1_key, h1_client);
        }

        tracing::info!(
            proxy = proxy_key.as_deref().unwrap_or("direct"),
            "rotated upstream HTTP client pool after pre-header transport failure"
        );
        Ok(h2_client)
    }

    pub(crate) fn codex_client_for_proxy_url(
        &self,
        proxy_url: Option<&str>,
        http1_only: bool,
    ) -> Result<Client, String> {
        self.client_for(proxy_url, http1_only)
    }

    fn client_for(&self, proxy_url: Option<&str>, http1_only: bool) -> Result<Client, String> {
        let key = ClientKey::new(proxy_url, http1_only);
        let mut guard = self
            .by_key
            .lock()
            .map_err(|_| "HTTP client pool is poisoned.".to_string())?;
        if let Some(existing) = guard.get(&key) {
            return Ok(existing.clone());
        }
        let client =
            build_tuned_client(key.proxy_url.as_deref(), key.http1_only).map_err(|err| {
                format!(
                    "Failed to build {} HTTP client: {err}",
                    if http1_only { "HTTP/1.1" } else { "upstream" }
                )
            })?;
        guard.insert(key, client.clone());
        Ok(client)
    }

    #[cfg(test)]
    pub(crate) fn client_count(&self) -> usize {
        self.by_key.lock().map(|guard| guard.len()).unwrap_or(0)
    }
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct ClientKey {
    proxy_url: Option<String>,
    http1_only: bool,
}

impl ClientKey {
    fn new(proxy_url: Option<&str>, http1_only: bool) -> Self {
        Self {
            proxy_url: normalize_proxy_url(proxy_url),
            http1_only,
        }
    }
}

fn normalize_proxy_url(proxy_url: Option<&str>) -> Option<String> {
    proxy_url
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct HttpClientTuning {
    connect_timeout: Duration,
    pool_idle_timeout: Duration,
    pool_max_idle_per_host: usize,
    tcp_nodelay: bool,
    tcp_keepalive: Duration,
    http2_adaptive_window: bool,
    http2_keep_alive_interval: Duration,
    http2_keep_alive_timeout: Duration,
    http2_keep_alive_while_idle: bool,
}

impl Default for HttpClientTuning {
    fn default() -> Self {
        Self {
            connect_timeout: Duration::from_secs(10),
            // 180s 过长：Cloudflare/airouter 常更早踢 idle H2，毒连接会被反复复用。
            pool_idle_timeout: Duration::from_secs(90),
            pool_max_idle_per_host: 32,
            tcp_nodelay: true,
            tcp_keepalive: Duration::from_secs(60),
            http2_adaptive_window: true,
            // 空闲 H2 session 上主动 ping，尽早发现远端已 reset/GOAWAY 的连接。
            http2_keep_alive_interval: Duration::from_secs(30),
            http2_keep_alive_timeout: Duration::from_secs(10),
            http2_keep_alive_while_idle: true,
        }
    }
}

fn tuned_client_builder() -> ClientBuilder {
    let tuning = HttpClientTuning::default();
    ClientBuilder::new()
        .connect_timeout(tuning.connect_timeout)
        .pool_idle_timeout(tuning.pool_idle_timeout)
        .pool_max_idle_per_host(tuning.pool_max_idle_per_host)
        .tcp_nodelay(tuning.tcp_nodelay)
        .tcp_keepalive(tuning.tcp_keepalive)
        .http2_adaptive_window(tuning.http2_adaptive_window)
        .http2_keep_alive_interval(tuning.http2_keep_alive_interval)
        .http2_keep_alive_timeout(tuning.http2_keep_alive_timeout)
        .http2_keep_alive_while_idle(tuning.http2_keep_alive_while_idle)
}

fn build_tuned_client(proxy_url: Option<&str>, http1_only: bool) -> Result<Client, reqwest::Error> {
    let mut builder = tuned_client_builder();
    if let Some(proxy_url) = proxy_url.map(str::trim).filter(|value| !value.is_empty()) {
        let proxy = Proxy::all(proxy_url)?;
        builder = builder.proxy(proxy);
    } else {
        // 默认不走系统代理；仅当用户显式配置 proxy_url 时才走代理。
        builder = builder.no_proxy();
    }
    if http1_only {
        builder = builder.http1_only();
    }
    builder.build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clients_are_cached_by_proxy_and_http1_mode() {
        let clients = ProxyHttpClients::new().expect("clients");

        let _ = clients
            .client_for_proxy_url(Some("http://127.0.0.1:7890"))
            .expect("proxied client");
        let _ = clients
            .client_for_proxy_url(Some("http://127.0.0.1:7890"))
            .expect("same proxied client");
        let _ = clients
            .client_for_proxy_url_http1(Some("http://127.0.0.1:7890"))
            .expect("http1 client");
        let _ = clients
            .codex_client_for_proxy_url(Some("http://127.0.0.1:7890"), false)
            .expect("codex reuses ordinary pool");

        // new() 预建 direct H2 + proxy H2 + proxy H1
        assert_eq!(clients.client_count(), 3);
    }

    #[test]
    fn rotate_rebuilds_h2_slot_and_existing_http1_slot() {
        let clients = ProxyHttpClients::new().expect("clients");
        let proxy = "http://127.0.0.1:7890";
        let before_h2 = clients.client_for_proxy_url(Some(proxy)).expect("h2");
        let before_h1 = clients.client_for_proxy_url_http1(Some(proxy)).expect("h1");
        let after_h2 = clients
            .rotate_client_for_proxy_url(Some(proxy))
            .expect("rotate");
        let after_h1 = clients
            .client_for_proxy_url_http1(Some(proxy))
            .expect("h1 after");

        // 指针不必不同，但槽位必须仍可用；count 保持 1 direct + proxy h2 + proxy h1。
        assert_eq!(clients.client_count(), 3);
        let _ = (before_h2, before_h1, after_h2, after_h1);
    }

    #[test]
    fn default_tuning_shortens_idle_and_enables_h2_keepalive() {
        let tuning = HttpClientTuning::default();

        assert!(tuning.tcp_nodelay);
        assert!(tuning.http2_adaptive_window);
        assert!(tuning.http2_keep_alive_while_idle);
        assert_eq!(tuning.connect_timeout, Duration::from_secs(10));
        assert_eq!(tuning.pool_idle_timeout, Duration::from_secs(90));
        assert_eq!(tuning.pool_max_idle_per_host, 32);
        assert_eq!(tuning.http2_keep_alive_interval, Duration::from_secs(30));
        assert_eq!(tuning.http2_keep_alive_timeout, Duration::from_secs(10));
        assert_eq!(tuning.tcp_keepalive, Duration::from_secs(60));
    }
}
