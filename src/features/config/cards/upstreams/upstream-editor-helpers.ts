import {
  createNativeInboundFormatSet,
  removeInboundFormatsInSet,
} from "@/features/config/inbound-formats";
import type { UpstreamForm } from "@/features/config/types";

export const ACCOUNT_BACKED_PROVIDERS = [
  "kiro",
  "codex",
  "antigravity",
] as const;

export function isAccountBackedProvider(provider: string) {
  return ACCOUNT_BACKED_PROVIDERS.some((value) => value === provider);
}

export function isAccountBackedProviderSet(providers: readonly string[]) {
  return providers.length === 1 && providers.some(isAccountBackedProvider);
}

export function createCopiedUpstreamId(
  sourceId: string,
  upstreams: readonly UpstreamForm[],
) {
  const base = sourceId.trim() || "upstream";
  const taken = new Set(
    upstreams.map((upstream) => upstream.id.trim()).filter((id) => id),
  );

  const prefix = `${base}-copy`;
  if (!taken.has(prefix)) {
    return prefix;
  }

  let suffix = 2;
  while (taken.has(`${prefix}-${suffix}`)) {
    suffix += 1;
  }
  return `${prefix}-${suffix}`;
}

export function normalizeProviders(values: readonly string[]) {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    output.push(trimmed);
  }
  return output;
}

export function providersEqual(
  left: readonly string[],
  right: readonly string[],
) {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

export function coerceProviderSelection(next: readonly string[]) {
  const normalized = normalizeProviders(next);
  const special = normalized.find(isAccountBackedProvider);
  if (!special) {
    return normalized;
  }
  return [special];
}

export function hasProvider(upstream: UpstreamForm, provider: string) {
  return upstream.providers.some((value) => value.trim() === provider);
}

export function pruneConvertFromMap(
  map: UpstreamForm["convertFromMap"],
  providers: readonly string[],
) {
  if (!Object.keys(map).length) {
    return map;
  }
  const providerSet = new Set(providers);
  const nativeFormatsInUpstream = createNativeInboundFormatSet(providers);
  const output: UpstreamForm["convertFromMap"] = {};
  for (const [provider, formats] of Object.entries(map)) {
    if (!providerSet.has(provider)) {
      continue;
    }
    const filtered = removeInboundFormatsInSet(
      formats,
      nativeFormatsInUpstream,
    );
    if (!filtered.length) {
      continue;
    }
    output[provider] = filtered;
  }
  return output;
}

export function cloneUpstreamDraft(upstream: UpstreamForm) {
  const providers = normalizeProviders(upstream.providers);
  return {
    ...upstream,
    // provider 必选：编辑/复制时也保证至少有一个 provider，避免 UI 出现“看起来有默认值但实际为空”的不同步体验
    providers: providers.length ? providers : ["openai"],
    availableModels: [...upstream.availableModels],
    modelMappings: upstream.modelMappings.map((mapping) => ({ ...mapping })),
    overrides: {
      header: upstream.overrides.header.map((entry) => ({ ...entry })),
    },
  };
}
