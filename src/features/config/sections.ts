import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Server, ScrollText, Settings } from "lucide-react";

export type ConfigSectionId = "dashboard" | "logs" | "upstreams" | "settings";

export type ConfigEditorSectionId = Extract<
  ConfigSectionId,
  "upstreams" | "settings"
>;

export type ConfigSection = {
  id: ConfigSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const CONFIG_SECTIONS: readonly ConfigSection[] = [
  {
    id: "dashboard",
    label: "仪表盘",
    description: "请求与 Token 使用",
    icon: LayoutDashboard,
  },
  {
    id: "upstreams",
    label: "提供商",
    description: "提供商、协议与模型配置",
    icon: Server,
  },
  {
    id: "logs",
    label: "日志",
    description: "请求日志与详情",
    icon: ScrollText,
  },
  {
    id: "settings",
    label: "设置",
    description: "服务、代理与应用设置",
    icon: Settings,
  },
] as const;

const CONFIG_SECTION_IDS: ReadonlySet<string> = new Set(
  CONFIG_SECTIONS.map((section) => section.id),
);

export const DEFAULT_CONFIG_SECTION: ConfigSectionId = "dashboard";

const CONFIG_SECTION_BY_ID: Record<ConfigSectionId, ConfigSection> =
  CONFIG_SECTIONS.reduce(
    (acc, section) => {
      acc[section.id] = section;
      return acc;
    },
    {} as Record<ConfigSectionId, ConfigSection>,
  );

export function isConfigSectionId(value: string): value is ConfigSectionId {
  return CONFIG_SECTION_IDS.has(value);
}

export function toConfigSectionId(value: string): ConfigSectionId | null {
  return isConfigSectionId(value) ? value : null;
}

export function getSection(sectionId: ConfigSectionId) {
  return CONFIG_SECTION_BY_ID[sectionId];
}

export function findSection(sectionId: ConfigSectionId) {
  return getSection(sectionId);
}
