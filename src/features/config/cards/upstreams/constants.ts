import type { UpstreamColumnDefinition } from "@/features/config/cards/upstreams/types";
import { m } from "@/paraglide/messages.js";

export const UPSTREAM_COLUMNS: readonly UpstreamColumnDefinition[] = [
  {
    id: "id",
    label: () => m.upstreams_column_id(),
    headerClassName: "w-[16%]",
    cellClassName: "w-[16%]",
  },
  {
    id: "provider",
    label: () => m.upstreams_column_provider(),
    headerClassName: "w-[46%]",
    cellClassName: "w-[46%]",
  },
  {
    id: "priority",
    label: () => m.upstreams_column_priority(),
    headerClassName: "w-[10%]",
    cellClassName: "w-[10%]",
  },
  {
    id: "status",
    label: () => m.upstreams_column_status(),
    headerClassName: "w-[12%]",
    cellClassName: "w-[12%]",
  },
];

export const PROTOCOL_OPTIONS = [
  "openai",
  "openai-response",
  "anthropic",
  "gemini",
] as const;

export function mergeProviderOptions(values: readonly string[]) {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const option of PROTOCOL_OPTIONS) {
    if (!seen.has(option)) {
      seen.add(option);
      merged.push(option);
    }
  }
  for (const option of values) {
    if (!seen.has(option)) {
      seen.add(option);
      merged.push(option);
    }
  }
  return merged;
}

export function toStatusLabel(enabled: boolean) {
  return enabled ? m.common_enabled() : m.common_disabled();
}

export function getUpstreamLabel(index: number) {
  return m.upstreams_upstream_n({ number: String(index + 1) });
}
