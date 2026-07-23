import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppView } from "@/features/config/AppView";
import { EMPTY_FORM } from "@/features/config/form";
import type { ProxyServiceStatus } from "@/features/config/types";

vi.mock("@/layouts/app-sidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar" />,
}));

vi.mock("@/layouts/site-header", () => ({
  SiteHeader: ({ title }: { title: string }) => (
    <div data-testid="site-header">{title}</div>
  ),
}));

vi.mock("@/features/config/cards", () => ({
  StorageUsageCard: () => <div data-testid="storage-usage-card" />,
  AutoStartCard: () => <div data-testid="auto-start-card" />,
  ProxyCoreCard: () => <div data-testid="proxy-core-card" />,
  UpdateCard: () => <div data-testid="update-card" />,
  UpstreamsCard: () => <div data-testid="upstreams-card" />,
}));

vi.mock("@/features/dashboard/DashboardPanel", () => ({
  DashboardPanel: () => <div data-testid="dashboard-panel" />,
}));

vi.mock("@/features/logs/LogsPanel", () => ({
  LogsPanel: () => <div data-testid="logs-panel" />,
}));

const IDLE_PROXY_STATUS: ProxyServiceStatus = {
  state: "stopped",
  addr: null,
  last_error: null,
};

const BASE_APP_VIEW_PROPS = {
  form: EMPTY_FORM,
  showLocalKey: false,
  showUpstreamKeys: false,
  providerOptions: [],
  autoStartEnabled: false,
  autoStartStatus: "idle" as const,
  autoStartMessage: "",
  proxyServiceStatus: IDLE_PROXY_STATUS,
  proxyServiceRequestState: "idle" as const,
  proxyServiceMessage: "",
  onToggleLocalKey: () => undefined,
  onToggleUpstreamKeys: () => undefined,
  onFormChange: () => undefined,
  onAutoStartChange: () => undefined,
  onAddUpstream: () => undefined,
  onRemoveUpstream: () => undefined,
  onChangeUpstream: () => undefined,
  onSave: () => undefined,
  onProxyServiceRefresh: () => undefined,
  onProxyServiceStart: () => undefined,
  onProxyServiceStop: () => undefined,
  onProxyServiceRestart: () => undefined,
  onProxyServiceReload: () => undefined,
};

afterEach(() => {
  cleanup();
});

describe("config/AppView", () => {
  it("shows retry action only inside error alert for dirty draft", () => {
    const onSave = vi.fn();

    render(
      <AppView
        activeSectionId="settings"
        {...BASE_APP_VIEW_PROPS}
        status="error"
        statusMessage="disk full"
        canSave
        isDirty
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "重试保存" }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
