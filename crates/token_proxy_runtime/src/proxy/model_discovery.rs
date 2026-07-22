use tokio::sync::RwLock;

pub use token_proxy_storage::dashboard::{UpstreamModelProbe, UpstreamModelProbeStatus};

#[derive(Default)]
pub(crate) struct UpstreamModelDiscoveryCache {
    probes: RwLock<Vec<UpstreamModelProbe>>,
}

impl UpstreamModelDiscoveryCache {
    pub(crate) fn new() -> Self {
        Self::default()
    }

    pub(crate) async fn snapshot(&self) -> Vec<UpstreamModelProbe> {
        self.probes.read().await.clone()
    }

    pub(crate) async fn replace_all(&self, probes: Vec<UpstreamModelProbe>) {
        *self.probes.write().await = probes;
    }

    pub(crate) async fn replace_at(&self, index: usize, probe: UpstreamModelProbe) {
        let mut probes = self.probes.write().await;
        if let Some(slot) = probes.get_mut(index) {
            *slot = probe;
            return;
        }
        probes.push(probe);
    }
}
