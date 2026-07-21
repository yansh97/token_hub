import type { UpstreamColumnDefinition } from "@/features/config/cards/upstreams/types";

export const UPSTREAM_COLUMNS: readonly UpstreamColumnDefinition[] = [
  {
    id: "id",
    label: () => "标识",
    headerClassName: "w-[16%]",
    cellClassName: "w-[16%]",
  },
  {
    id: "provider",
    label: () => "接口格式",
    headerClassName: "w-[42%]",
    cellClassName: "w-[42%]",
  },
  {
    id: "priority",
    label: () => "优先级",
    headerClassName: "w-[10%]",
    cellClassName: "w-[10%]",
  },
  {
    id: "status",
    label: () => "状态",
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

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  "openai-response": "OpenAI Responses",
  anthropic: "Anthropic",
  gemini: "Gemini",
};

export function getProviderLabel(provider: string) {
  return PROVIDER_LABELS[provider] ?? provider;
}

export function toStatusLabel(enabled: boolean) {
  return enabled ? "已启用" : "已停用";
}

export function getUpstreamLabel(index: number) {
  return `提供商 ${index + 1}`;
}
