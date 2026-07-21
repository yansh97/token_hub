import { invoke } from "@tauri-apps/api/core";

import { createEmptyUpstream, EMPTY_FORM, toPayload } from "@/features/config/form";
import type {
  ConfigResponse,
  SaveProxyConfigResult,
  UpstreamConfig,
} from "@/features/config/types";
import { listXaiAccounts } from "@/features/xai/api";

function isManagedXaiDefaultUpstream(upstream: UpstreamConfig) {
  const providers = (upstream.providers ?? []).map((provider) => provider.trim()).filter(Boolean);
  return upstream.id.trim() === "xai-default" && providers.length === 1 && providers[0] === "xai";
}

function createXaiDefaultUpstreamConfig() {
  const upstream = createEmptyUpstream();
  upstream.id = "xai-default";
  upstream.providers = ["xai"];
  upstream.enabled = true;
  const [config] = toPayload({ ...EMPTY_FORM, upstreams: [upstream] }).upstreams;
  if (!config) {
    throw new Error("Failed to create the managed xAI upstream.");
  }
  return config;
}

export function syncManagedXaiDefaultUpstreams(
  upstreams: UpstreamConfig[],
  hasXaiAccount: boolean,
) {
  const managedIndex = upstreams.findIndex(isManagedXaiDefaultUpstream);
  if (hasXaiAccount) {
    return managedIndex >= 0 ? upstreams : [...upstreams, createXaiDefaultUpstreamConfig()];
  }
  return managedIndex < 0
    ? upstreams
    : upstreams.filter((upstream) => !isManagedXaiDefaultUpstream(upstream));
}

export async function syncXaiDefaultUpstreamConfig() {
  // 账户列表与配置读取均为本地 IPC，可并行获取；列表失败时禁止把默认上游误删。
  const [accounts, response] = await Promise.all([
    listXaiAccounts(),
    invoke<ConfigResponse>("read_proxy_config"),
  ]);
  const upstreams = syncManagedXaiDefaultUpstreams(
    response.config.upstreams,
    accounts.length > 0,
  );
  if (upstreams === response.config.upstreams) {
    return false;
  }

  const result = await invoke<SaveProxyConfigResult>("save_proxy_config", {
    config: {
      ...response.config,
      upstreams,
    },
  });
  console.info("[providers-xai-upstream] synchronized managed upstream", {
    enabled: accounts.length > 0,
    upstreamCount: upstreams.length,
    applyError: Boolean(result.apply_error),
  });
  if (result.apply_error) {
    throw new Error(result.apply_error);
  }
  return true;
}
