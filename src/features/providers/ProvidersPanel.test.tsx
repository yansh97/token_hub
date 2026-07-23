import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { open } from "@tauri-apps/plugin-dialog";

import { ProvidersPanel } from "@/features/providers/ProvidersPanel";
import type {
  ProviderAccountPageItem,
  ProviderAccountsPage,
} from "@/features/providers/types";
import { m } from "@/paraglide/messages.js";
import { setLocale } from "@/paraglide/runtime.js";

const providerMocks = vi.hoisted(() => {
  let kiroAccountsLoading = false;
  let kiroQuotasLoading = false;
  let codexAccountsLoading = false;
  let codexQuotasLoading = false;
  let xaiAccountsLoading = false;
  const allCodexAccounts = [
    {
      account_id: "codex-1",
      email: "bob@example.com",
      expires_at: "2026-04-01T00:00:00Z",
      status: "expired" as const,
      auto_refresh_enabled: true,
      priority: 1,
      proxy_url: "",
    },
    {
      account_id: "codex-2",
      email: "two@example.com",
      expires_at: "2026-07-01T00:00:00Z",
      status: "active" as const,
      auto_refresh_enabled: true,
      priority: 0,
      proxy_url: "",
    },
    {
      account_id: "codex-agent",
      email: "agent@example.com",
      expires_at: null,
      status: "active" as const,
      auth_method: "agent_identity" as const,
      auto_refresh_enabled: null,
      priority: 10,
      proxy_url: "",
    },
  ];
  const allXaiAccounts = [
    {
      account_id: "xai-1",
      email: "grok@example.com",
      expires_at: "2026-07-01T00:00:00Z",
      status: "active" as const,
      auto_refresh_enabled: true,
      priority: 3,
      proxy_url: "",
    },
  ];
  const refreshKiroAccounts = vi.fn(async () => undefined);
  const refreshCodexAccounts = vi.fn(async () => allCodexAccounts);
  const refreshCodexAccount = vi.fn(async () => undefined);
  const refreshXaiAccounts = vi.fn(async () => allXaiAccounts);
  const refreshXaiAccount = vi.fn(async () => undefined);
  const refreshKiroQuotaCache = vi.fn(async () => undefined);
  const refreshCodexQuotaCache = vi.fn(async () => undefined);
  const refreshXaiQuotaCache = vi.fn(async () => undefined);
  const refreshKiroQuotaNow = vi.fn(async () => undefined);
  const refreshCodexQuotaNow = vi.fn(async () => undefined);
  const refreshXaiQuotaNow = vi.fn(async () => undefined);
  const setCodexAutoRefresh = vi.fn(async () => ({
    account_id: "codex-1",
    email: "bob@example.com",
    expires_at: "2026-04-01T00:00:00Z",
    status: "expired" as const,
    auto_refresh_enabled: true,
  }));
  const setXaiAutoRefresh = vi.fn(async () => ({ ...allXaiAccounts[0] }));
  const refreshKiroQuotas = vi.fn(async () => undefined);
  const refreshCodexQuotas = vi.fn(async () => undefined);
  const logoutKiro = vi.fn(async () => undefined);
  const logoutCodex = vi.fn(async () => undefined);
  const logoutXai = vi.fn(async () => undefined);
  const setKiroProxyUrl = vi.fn(async () => ({
    account_id: "kiro-1",
    provider: "kiro" as const,
    auth_method: "google",
    email: "alice@example.com",
    expires_at: "2026-05-01T00:00:00Z",
    status: "active" as const,
    priority: 2,
    proxy_url: "http://127.0.0.1:7890",
  }));
  const setKiroPriority = vi.fn(async () => ({
    account_id: "kiro-1",
    provider: "kiro" as const,
    auth_method: "google",
    email: "alice@example.com",
    expires_at: "2026-05-01T00:00:00Z",
    status: "active" as const,
    priority: 12,
    proxy_url: "http://127.0.0.1:7890",
  }));
  const setKiroStatus = vi.fn(async () => ({
    account_id: "kiro-1",
    provider: "kiro" as const,
    auth_method: "google",
    email: "alice@example.com",
    expires_at: "2026-05-01T00:00:00Z",
    status: "disabled" as const,
    priority: 2,
    proxy_url: "http://127.0.0.1:7890",
  }));
  const setCodexProxyUrl = vi.fn(async () => ({
    account_id: "codex-1",
    email: "bob@example.com",
    expires_at: "2026-04-01T00:00:00Z",
    status: "expired" as const,
    auto_refresh_enabled: true,
    priority: 1,
    proxy_url: "socks5://127.0.0.1:1080",
  }));
  const setCodexPriority = vi.fn(async () => ({
    account_id: "codex-1",
    email: "bob@example.com",
    expires_at: "2026-04-01T00:00:00Z",
    status: "expired" as const,
    auto_refresh_enabled: true,
    priority: 21,
    proxy_url: "",
  }));
  const setCodexStatus = vi.fn(async () => ({
    account_id: "codex-1",
    email: "bob@example.com",
    expires_at: "2026-04-01T00:00:00Z",
    status: "disabled" as const,
    auto_refresh_enabled: true,
    priority: 1,
    proxy_url: "",
  }));
  const setXaiStatus = vi.fn(async () => ({ ...allXaiAccounts[0], status: "disabled" as const }));
  const setXaiProxyUrl = vi.fn(async () => ({ ...allXaiAccounts[0], proxy_url: "http://127.0.0.1:7890" }));
  const setXaiPriority = vi.fn(async () => ({ ...allXaiAccounts[0], priority: 12 }));
  const beginKiroLogin = vi.fn();
  const beginCodexLogin = vi.fn();
  const beginXaiLogin = vi.fn();
  const resetKiroLogin = vi.fn();
  const resetCodexLogin = vi.fn();
  const resetXaiLogin = vi.fn();
  const importKiroIde = vi.fn(async () => [
    {
      account_id: "kiro-1",
      provider: "kiro" as const,
      auth_method: "google",
      email: "alice@example.com",
      expires_at: "2026-05-01T00:00:00Z",
      status: "active" as const,
      priority: 2,
      proxy_url: "http://127.0.0.1:7890",
    },
  ]);
  const importKiroKam = vi.fn(async () => [
    {
      account_id: "kiro-1",
      provider: "kiro" as const,
      auth_method: "google",
      email: "alice@example.com",
      expires_at: "2026-05-01T00:00:00Z",
      status: "active" as const,
      priority: 2,
      proxy_url: "http://127.0.0.1:7890",
    },
  ]);
  const importCodexFile = vi.fn(async () => [
    {
      account_id: "codex-1",
      email: "bob@example.com",
      expires_at: "2026-04-01T00:00:00Z",
      status: "expired" as const,
      priority: 1,
    },
  ]);
  const importCodexText = vi.fn(async () => [
    {
      account_id: "codex-1",
      email: "bob@example.com",
      expires_at: "2026-04-01T00:00:00Z",
      status: "expired" as const,
      priority: 1,
    },
  ]);
  const importCodexRefreshTokens = vi.fn(async () => [
    {
      account_id: "codex-1",
      email: "bob@example.com",
      expires_at: "2026-04-01T00:00:00Z",
      status: "expired" as const,
      priority: 1,
    },
  ]);
  const importXaiFile = vi.fn(async () => [{ ...allXaiAccounts[0] }]);
  const importXaiText = vi.fn(async () => [{ ...allXaiAccounts[0] }]);
  const importXaiRefreshTokens = vi.fn(async () => [{ ...allXaiAccounts[0] }]);
  const syncXaiDefaultUpstreamConfig = vi.fn(async () => true);
  const deleteProviderAccounts = vi.fn(async () => undefined);
  const buildCounts = (rows: ProviderAccountPageItem[]) => ({
    all: rows.length,
    active: rows.filter((row) => row.status === "active").length,
    disabled: rows.filter((row) => row.status === "disabled").length,
    expired: rows.filter((row) => row.status === "expired").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
    cooling_down: rows.filter((row) => row.status === "cooling_down").length,
  });
  const listProviderAccountsPage = vi.fn(
    async ({
      page = 1,
      pageSize = 10,
      providerKind,
      status,
      search,
    }: {
      page?: number;
      pageSize?: number;
      providerKind?: "kiro" | "codex" | "xai";
      status?: "active" | "disabled" | "expired" | "invalid" | "cooling_down";
      search?: string;
    }) => {
      const rows: ProviderAccountPageItem[] = [
        {
          provider_kind: "kiro" as const,
          account_id: "kiro-1",
          email: "alice@example.com",
          expires_at: "2026-05-01T00:00:00Z",
          status: "active" as const,
          auth_method: "google",
          provider_name: "kiro",
          priority: 2,
          proxy_url: "http://127.0.0.1:7890",
          quota: {
            plan_type: "Kiro Cached Plan",
            error: null,
            checked_at: "2026-04-01T00:00:00Z",
            items: [
              {
                name: "Requests",
                percentage: 25,
                used: 25,
                limit: 100,
                reset_at: "2026-04-15T00:00:00Z",
                is_trial: false,
              },
            ],
          },
        },
        {
          provider_kind: "codex" as const,
          account_id: "codex-1",
          email: "bob@example.com",
          expires_at: "2026-04-01T00:00:00Z",
          status: "expired" as const,
          auth_method: null,
          provider_name: null,
          auto_refresh_enabled: true,
          priority: 1,
          proxy_url: "",
          quota: {
            plan_type: "Codex Cached Plan",
            error: null,
            checked_at: "2026-04-01T00:00:00Z",
            items: [
              {
                name: "codex-weekly",
                percentage: 50,
                used: 50,
                limit: 100,
                reset_at: "2026-04-08T00:00:00Z",
                is_trial: false,
              },
            ],
          },
        },
      ];
      const keyword = search?.trim().toLowerCase() ?? "";
      const scopedRows = rows.filter((row) => {
        if (providerKind && row.provider_kind !== providerKind) {
          return false;
        }
        if (!keyword) {
          return true;
        }
        return `${row.email ?? ""} ${row.account_id}`.toLowerCase().includes(keyword);
      });
      const filtered = status ? scopedRows.filter((row) => row.status === status) : scopedRows;
      const offset = (page - 1) * pageSize;
      return {
        items: filtered.slice(offset, offset + pageSize),
        total: filtered.length,
        page,
        page_size: pageSize,
        status_counts: buildCounts(scopedRows),
      };
    }
  );
  const toastError = vi.fn();
  const toastSuccess = vi.fn();

  return {
    get kiroAccountsLoading() {
      return kiroAccountsLoading;
    },
    set kiroAccountsLoading(value: boolean) {
      kiroAccountsLoading = value;
    },
    get kiroQuotasLoading() {
      return kiroQuotasLoading;
    },
    set kiroQuotasLoading(value: boolean) {
      kiroQuotasLoading = value;
    },
    get codexAccountsLoading() {
      return codexAccountsLoading;
    },
    set codexAccountsLoading(value: boolean) {
      codexAccountsLoading = value;
    },
    get codexQuotasLoading() {
      return codexQuotasLoading;
    },
    set codexQuotasLoading(value: boolean) {
      codexQuotasLoading = value;
    },
    get xaiAccountsLoading() {
      return xaiAccountsLoading;
    },
    set xaiAccountsLoading(value: boolean) {
      xaiAccountsLoading = value;
    },
    refreshKiroAccounts,
    refreshCodexAccounts,
    refreshCodexAccount,
    refreshXaiAccounts,
    refreshXaiAccount,
    refreshKiroQuotaCache,
    refreshCodexQuotaCache,
    refreshXaiQuotaCache,
    refreshKiroQuotaNow,
    refreshCodexQuotaNow,
    refreshXaiQuotaNow,
    setCodexAutoRefresh,
    setXaiAutoRefresh,
    refreshKiroQuotas,
    refreshCodexQuotas,
    logoutKiro,
    logoutCodex,
    logoutXai,
    setKiroProxyUrl,
    setKiroPriority,
    setKiroStatus,
    setCodexProxyUrl,
    setCodexPriority,
    setCodexStatus,
    setXaiStatus,
    setXaiProxyUrl,
    setXaiPriority,
    beginKiroLogin,
    beginCodexLogin,
    beginXaiLogin,
    resetKiroLogin,
    resetCodexLogin,
    resetXaiLogin,
    importKiroIde,
    importKiroKam,
    importCodexFile,
    importCodexText,
    importCodexRefreshTokens,
    importXaiFile,
    importXaiText,
    importXaiRefreshTokens,
    syncXaiDefaultUpstreamConfig,
    deleteProviderAccounts,
    listProviderAccountsPage,
    toastError,
    toastSuccess,
    allCodexAccounts,
    allXaiAccounts,
  };
});

vi.mock("@tauri-apps/api/path", () => ({
  homeDir: vi.fn(async () => "/Users/test"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async () => null),
}));

vi.mock("sonner", () => ({
  toast: {
    error: providerMocks.toastError,
    success: providerMocks.toastSuccess,
  },
}));

vi.mock("@/features/kiro/use-kiro-accounts", () => ({
  useKiroAccounts: () => ({
    accounts: [
      {
        account_id: "kiro-1",
        provider: "kiro",
        auth_method: "google",
        email: "alice@example.com",
        expires_at: "2026-05-01T00:00:00Z",
        status: "active",
        proxy_url: "http://127.0.0.1:7890",
      },
    ],
    loading: providerMocks.kiroAccountsLoading,
    error: "",
    refresh: providerMocks.refreshKiroAccounts,
    logout: providerMocks.logoutKiro,
    importIde: providerMocks.importKiroIde,
    importKam: providerMocks.importKiroKam,
    refreshQuotaCache: providerMocks.refreshKiroQuotaCache,
    refreshQuotaNow: providerMocks.refreshKiroQuotaNow,
    setProxyUrl: providerMocks.setKiroProxyUrl,
    setPriority: providerMocks.setKiroPriority,
    setStatus: providerMocks.setKiroStatus,
  }),
}));

vi.mock("@/features/codex/use-codex-accounts", () => ({
  useCodexAccounts: () => ({
    accounts: providerMocks.allCodexAccounts,
    loading: providerMocks.codexAccountsLoading,
    error: "",
    refresh: providerMocks.refreshCodexAccounts,
    refreshAccount: providerMocks.refreshCodexAccount,
    refreshQuotaCache: providerMocks.refreshCodexQuotaCache,
    refreshQuotaNow: providerMocks.refreshCodexQuotaNow,
    setAutoRefresh: providerMocks.setCodexAutoRefresh,
    setProxyUrl: providerMocks.setCodexProxyUrl,
    setPriority: providerMocks.setCodexPriority,
    setStatus: providerMocks.setCodexStatus,
    logout: providerMocks.logoutCodex,
    importFile: providerMocks.importCodexFile,
    importText: providerMocks.importCodexText,
    importRefreshTokens: providerMocks.importCodexRefreshTokens,
  }),
}));

vi.mock("@/features/xai/use-xai-accounts", () => ({
  useXaiAccounts: () => ({
    accounts: providerMocks.allXaiAccounts,
    loading: providerMocks.xaiAccountsLoading,
    error: "",
    refresh: providerMocks.refreshXaiAccounts,
    refreshAccount: providerMocks.refreshXaiAccount,
    refreshQuotaCache: providerMocks.refreshXaiQuotaCache,
    refreshQuotaNow: providerMocks.refreshXaiQuotaNow,
    setAutoRefresh: providerMocks.setXaiAutoRefresh,
    setProxyUrl: providerMocks.setXaiProxyUrl,
    setPriority: providerMocks.setXaiPriority,
    setStatus: providerMocks.setXaiStatus,
    logout: providerMocks.logoutXai,
    importFile: providerMocks.importXaiFile,
    importText: providerMocks.importXaiText,
    importRefreshTokens: providerMocks.importXaiRefreshTokens,
  }),
}));

vi.mock("@/features/kiro/use-kiro-quotas", () => ({
  useKiroQuotas: () => ({
    quotas: [
      {
        account_id: "kiro-1",
        provider: "kiro",
        plan_type: "Pro",
        error: null,
        quotas: [
          {
            name: "Requests",
            percentage: 25,
            used: 25,
            limit: 100,
            reset_at: "2026-04-15T00:00:00Z",
            is_trial: false,
          },
        ],
      },
    ],
    loading: providerMocks.kiroQuotasLoading,
    error: "",
    refresh: providerMocks.refreshKiroQuotas,
  }),
}));

vi.mock("@/features/codex/use-codex-quotas", () => ({
  useCodexQuotas: () => ({
    quotas: [
      {
        account_id: "codex-1",
        plan_type: "Plus",
        error: null,
        quotas: [
          {
            name: "codex-weekly",
            percentage: 50,
            used: 50,
            limit: 100,
            reset_at: "2026-04-08T00:00:00Z",
          },
        ],
      },
    ],
    loading: providerMocks.codexQuotasLoading,
    error: "",
    refresh: providerMocks.refreshCodexQuotas,
  }),
}));

vi.mock("@/features/kiro/use-kiro-login", () => ({
  useKiroLogin: () => ({
    login: { status: "idle" },
    beginLogin: providerMocks.beginKiroLogin,
    resetLogin: providerMocks.resetKiroLogin,
  }),
}));

vi.mock("@/features/codex/use-codex-login", () => ({
  useCodexLogin: () => ({
    login: { status: "idle" },
    beginLogin: providerMocks.beginCodexLogin,
    resetLogin: providerMocks.resetCodexLogin,
  }),
}));

vi.mock("@/features/xai/use-xai-login", () => ({
  useXaiLogin: () => ({
    login: { status: "idle" },
    beginLogin: providerMocks.beginXaiLogin,
    resetLogin: providerMocks.resetXaiLogin,
  }),
}));

vi.mock("@/features/config/sync-xai-default-upstream", () => ({
  syncXaiDefaultUpstreamConfig: providerMocks.syncXaiDefaultUpstreamConfig,
}));

vi.mock("@/features/providers/api", () => ({
  listProviderAccountsPage: providerMocks.listProviderAccountsPage,
  deleteProviderAccounts: providerMocks.deleteProviderAccounts,
}));

async function findAccountRow(label: string) {
  const table = await screen.findByTestId("providers-pagination-indicator");
  const container = table.closest("section");
  if (!(container instanceof HTMLElement)) {
    throw new Error("Missing providers section");
  }
  const accountCell = await within(container).findByText(label);
  const row = accountCell.closest("tr");
  if (!(row instanceof HTMLTableRowElement)) {
    throw new Error(`Missing table row for ${label}`);
  }
  return row;
}

function getToolbar() {
  const toolbar = document.querySelector('[data-slot="providers-toolbar"]');
  if (!(toolbar instanceof HTMLElement)) {
    throw new Error("Missing providers toolbar");
  }
  return toolbar;
}

function getAccountsTable() {
  const table = document.querySelector('[data-slot="providers-accounts-table"]');
  if (!(table instanceof HTMLElement)) {
    throw new Error("Missing providers accounts table");
  }
  return table;
}

function getAddLabel() {
  return m.providers_add_account();
}

async function openAddAccountDialog(user: ReturnType<typeof userEvent.setup>) {
  const addButton = document.querySelector('[data-slot="providers-toolbar-add"]');
  if (!(addButton instanceof HTMLButtonElement)) {
    throw new Error("Missing providers add button");
  }
  await user.click(addButton);
}

async function switchAddProviderToCodex(user: ReturnType<typeof userEvent.setup>) {
  const switchButton = document.querySelector('[data-slot="providers-add-provider-codex"]');
  if (!(switchButton instanceof HTMLButtonElement)) {
    throw new Error("Missing providers add codex switch button");
  }
  await user.click(switchButton);
}

async function switchAddProviderToXai(user: ReturnType<typeof userEvent.setup>) {
  const switchButton = document.querySelector('[data-slot="providers-add-provider-xai"]');
  if (!(switchButton instanceof HTMLButtonElement)) {
    throw new Error("Missing providers add xai switch button");
  }
  await user.click(switchButton);
}

async function switchCodexMode(user: ReturnType<typeof userEvent.setup>, mode: string) {
  const modeButton = document.querySelector(`[data-slot="providers-add-codex-mode-${mode}"]`);
  if (!(modeButton instanceof HTMLButtonElement)) {
    throw new Error(`Missing codex mode button: ${mode}`);
  }
  await user.click(modeButton);
}

async function switchXaiMode(user: ReturnType<typeof userEvent.setup>, mode: string) {
  const modeButton = document.querySelector(`[data-slot="providers-add-xai-mode-${mode}"]`);
  if (!(modeButton instanceof HTMLButtonElement)) {
    throw new Error(`Missing xai mode button: ${mode}`);
  }
  await user.click(modeButton);
}

function getAddProviderPanel(provider: "kiro" | "codex" | "xai") {
  const panel = document.querySelector(`[data-slot="providers-add-panel-${provider}"]`);
  if (!(panel instanceof HTMLElement)) {
    throw new Error(`Missing providers add ${provider} panel`);
  }
  return panel;
}

function createXaiAccountsPage(): ProviderAccountsPage {
  return {
    items: [
      {
        provider_kind: "xai",
        account_id: "xai-1",
        email: "grok@example.com",
        expires_at: "2026-07-01T00:00:00Z",
        status: "active",
        auth_method: "oauth",
        provider_name: "xai",
        auto_refresh_enabled: true,
        priority: 3,
        proxy_url: "",
        quota: {
          plan_type: "SuperGrok",
          error: null,
          checked_at: "2026-07-20T00:00:00Z",
          items: [],
        },
      },
    ],
    total: 1,
    page: 1,
    page_size: 10,
    status_counts: {
      all: 1,
      active: 1,
      disabled: 0,
      expired: 0,
      invalid: 0,
      cooling_down: 0,
    },
  };
}

async function openXaiAccountDialog(user: ReturnType<typeof userEvent.setup>) {
  providerMocks.listProviderAccountsPage.mockResolvedValueOnce(createXaiAccountsPage());
  render(<ProvidersPanel />);
  await user.click(
    within(await findAccountRow("grok@example.com")).getByRole("button", {
      name: m.providers_account_dialog_title(),
    }),
  );
  return screen.getByRole("dialog");
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  setLocale("en", { reload: false });
  providerMocks.kiroAccountsLoading = false;
  providerMocks.kiroQuotasLoading = false;
  providerMocks.codexAccountsLoading = false;
  providerMocks.codexQuotasLoading = false;
  providerMocks.xaiAccountsLoading = false;
});

describe("providers/ProvidersPanel", () => {
  it("renders accounts in a unified table", async () => {
    render(<ProvidersPanel />);

    expect(
      await screen.findByRole("columnheader", { name: m.providers_table_provider() })
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: m.providers_table_account() })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: m.field_priority() })).toBeInTheDocument();
    expect(within(getAccountsTable()).getByText("alice@example.com")).toBeInTheDocument();
    expect(within(getAccountsTable()).getByText("bob@example.com")).toBeInTheDocument();
    expect(within(getAccountsTable()).getByText("Kiro Cached Plan")).toBeInTheDocument();
    expect(within(getAccountsTable()).getByText("Codex Cached Plan")).toBeInTheDocument();
  });

  it("keeps API order so higher priority accounts render first across providers", async () => {
    providerMocks.listProviderAccountsPage.mockResolvedValueOnce({
      items: [
        {
          provider_kind: "codex",
          account_id: "codex-1",
          email: "bob@example.com",
          expires_at: "2026-04-01T00:00:00Z",
          status: "expired",
          auth_method: null,
          provider_name: null,
          auto_refresh_enabled: true,
          priority: 20,
          proxy_url: "",
          quota: {
            plan_type: "Codex Cached Plan",
            error: null,
            checked_at: "2026-04-01T00:00:00Z",
            items: [],
          },
        } as ProviderAccountPageItem,
        {
          provider_kind: "kiro",
          account_id: "kiro-1",
          email: "alice@example.com",
          expires_at: "2026-05-01T00:00:00Z",
          status: "active",
          auth_method: "google",
          provider_name: "kiro",
          priority: 2,
          proxy_url: "http://127.0.0.1:7890",
          quota: {
            plan_type: "Kiro Cached Plan",
            error: null,
            checked_at: "2026-04-01T00:00:00Z",
            items: [],
          },
        } as ProviderAccountPageItem,
      ],
      total: 2,
      page: 1,
      page_size: 10,
      status_counts: {
        all: 2,
        active: 1,
        disabled: 0,
        expired: 1,
        invalid: 0,
        cooling_down: 0,
      },
    });

    render(<ProvidersPanel />);

    await screen.findByRole("columnheader", { name: m.providers_table_provider() });
    const tableRows = await within(getAccountsTable()).findAllByRole("row");
    expect(within(tableRows[1]!).getByText("bob@example.com")).toBeInTheDocument();
    expect(within(tableRows[2]!).getByText("alice@example.com")).toBeInTheDocument();
  });

  it("does not render extra provider group panels below the accounts table", () => {
    render(<ProvidersPanel />);

    expect(document.querySelector('[data-slot="provider-group"]')).toBeNull();
  });

  it("filters rows by search keyword", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await user.type(
      within(getToolbar()).getByRole("textbox", { name: m.providers_toolbar_search_placeholder() }),
      "alice"
    );

    await waitFor(() => {
      expect(within(getAccountsTable()).queryByText("bob@example.com")).not.toBeInTheDocument();
    });
    expect(within(getAccountsTable()).getByText("alice@example.com")).toBeInTheDocument();
  });

  it("debounces search requests while typing", async () => {
    render(<ProvidersPanel />);

    await waitFor(() => {
      expect(providerMocks.listProviderAccountsPage).toHaveBeenCalledTimes(1);
    });
    providerMocks.listProviderAccountsPage.mockClear();
    const searchInput = within(getToolbar()).getByRole("textbox", {
      name: m.providers_toolbar_search_placeholder(),
    });

    fireEvent.change(searchInput, { target: { value: "a" } });
    fireEvent.change(searchInput, { target: { value: "al" } });
    fireEvent.change(searchInput, { target: { value: "alice" } });

    expect(providerMocks.listProviderAccountsPage).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(providerMocks.listProviderAccountsPage).toHaveBeenCalledTimes(1);
    });
    expect(providerMocks.listProviderAccountsPage).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      providerKind: undefined,
      status: undefined,
      search: "alice",
    });
  });

  it("filters rows by provider and status", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await user.click(within(getToolbar()).getByLabelText(m.providers_filter_provider_label()));
    await user.click(screen.getByRole("option", { name: m.providers_codex_title() }));

    expect(within(getAccountsTable()).queryByText("alice@example.com")).not.toBeInTheDocument();
    expect(within(getAccountsTable()).getByText("bob@example.com")).toBeInTheDocument();

    await user.click(within(getToolbar()).getByLabelText(m.providers_filter_status_label()));
    await user.click(screen.getByRole("option", { name: m.codex_account_status_expired() }));

    expect(within(getAccountsTable()).getByText("bob@example.com")).toBeInTheDocument();
    expect(within(getAccountsTable()).queryByText("alice@example.com")).not.toBeInTheDocument();
  });

  it("shows invalid account counts and filters invalid accounts from summary", async () => {
    const user = userEvent.setup();
    providerMocks.listProviderAccountsPage.mockImplementation(
      async ({ status }: { status?: "active" | "disabled" | "expired" | "invalid" | "cooling_down" }) => {
        const rows: ProviderAccountPageItem[] = [
          {
            provider_kind: "codex",
            account_id: "codex-valid",
            email: "valid@example.com",
            expires_at: "2026-07-01T00:00:00Z",
            status: "active",
            auth_method: null,
            provider_name: null,
            auto_refresh_enabled: true,
            priority: 1,
            proxy_url: "",
            quota: { plan_type: null, error: null, checked_at: null, items: [] },
          },
          {
            provider_kind: "codex",
            account_id: "codex-invalid",
            email: "invalid@example.com",
            expires_at: "2026-07-01T00:00:00Z",
            status: "invalid",
            auth_method: null,
            provider_name: null,
            auto_refresh_enabled: true,
            priority: 0,
            proxy_url: "",
            quota: {
              plan_type: null,
              error: "Codex 登录已失效，请重新登录该账户。",
              checked_at: "2026-04-01T00:00:00Z",
              items: [],
            },
          },
        ];
        const filtered = status ? rows.filter((row) => row.status === status) : rows;
        return {
          items: filtered,
          total: filtered.length,
          page: 1,
          page_size: 10,
          status_counts: {
            all: 2,
            active: 1,
            disabled: 0,
            expired: 0,
            invalid: 1,
            cooling_down: 0,
          },
        };
      }
    );

    render(<ProvidersPanel />);

    const summary = document.querySelector('[data-slot="providers-status-summary"]');
    if (!(summary instanceof HTMLElement)) {
      throw new Error("Missing providers status summary");
    }
    expect(await within(summary).findByText(m.codex_account_status_invalid())).toBeInTheDocument();
    const invalidSummaryButton = summary.querySelector('[data-slot="providers-status-summary-invalid"]');
    if (!(invalidSummaryButton instanceof HTMLButtonElement)) {
      throw new Error("Missing invalid status summary button");
    }
    await waitFor(() => {
      expect(invalidSummaryButton).toHaveTextContent(`${m.codex_account_status_invalid()}1`);
    });

    await user.click(invalidSummaryButton);

    await waitFor(() => {
      expect(providerMocks.listProviderAccountsPage).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 10,
        providerKind: undefined,
        status: "invalid",
        search: "",
      });
    });
    expect(within(getAccountsTable()).getByText("invalid@example.com")).toBeInTheDocument();
    expect(within(getAccountsTable()).queryByText("valid@example.com")).not.toBeInTheDocument();
  });

  it("refreshes all auto-refresh Codex tokens from toolbar action", async () => {
    const user = userEvent.setup();
    providerMocks.listProviderAccountsPage.mockResolvedValue({
      items: [
        {
          provider_kind: "codex",
          account_id: "codex-1",
          email: "one@example.com",
          expires_at: "2026-07-01T00:00:00Z",
          status: "active",
          auth_method: null,
          provider_name: null,
          auto_refresh_enabled: true,
          priority: 2,
          proxy_url: "",
          quota: { plan_type: null, error: null, checked_at: null, items: [] },
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
      status_counts: {
        all: 2,
        active: 2,
        disabled: 0,
        expired: 0,
        invalid: 0,
        cooling_down: 0,
      },
    });

    render(<ProvidersPanel />);
    await screen.findByText("one@example.com");
    expect(screen.queryByText("two@example.com")).not.toBeInTheDocument();
    await user.click(
      within(getToolbar()).getByRole("button", {
        name: m.providers_refresh_all_codex_tokens(),
      })
    );

    await waitFor(() => {
      expect(providerMocks.refreshCodexAccount).toHaveBeenCalledWith("codex-1");
      expect(providerMocks.refreshCodexAccount).toHaveBeenCalledWith("codex-2");
    });
    expect(providerMocks.refreshCodexAccount).not.toHaveBeenCalledWith("codex-agent");
    expect(providerMocks.toastSuccess).toHaveBeenCalledWith(
      m.providers_refresh_all_codex_tokens_success({ count: 2 })
    );
  });

  it("renders Agent Identity without OAuth-only controls", async () => {
    const user = userEvent.setup();
    providerMocks.listProviderAccountsPage.mockResolvedValueOnce({
      items: [
        {
          provider_kind: "codex",
          account_id: "codex-agent",
          email: "agent@example.com",
          expires_at: null,
          status: "active",
          auth_method: "agent_identity",
          provider_name: "codex",
          auto_refresh_enabled: null,
          priority: 10,
          proxy_url: "",
          quota: {
            plan_type: "team",
            error: null,
            checked_at: null,
            items: [],
          },
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
      status_counts: {
        all: 1,
        active: 1,
        disabled: 0,
        expired: 0,
        invalid: 0,
        cooling_down: 0,
      },
    });

    render(<ProvidersPanel />);
    const row = await findAccountRow("agent@example.com");
    expect(within(row).getByText(m.codex_auth_method_agent_identity())).toBeInTheDocument();
    await user.click(
      within(row).getByRole("button", { name: m.providers_account_dialog_title() })
    );
    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveTextContent(m.codex_auth_method_agent_identity());
    expect(
      within(dialog).queryByRole("button", { name: m.common_refresh() })
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("switch", { name: m.providers_account_auto_refresh() })
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByText(m.providers_table_expires())).not.toBeInTheDocument();
  });

  it("opens account dialog from edit action", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await user.click(
      within(await findAccountRow("alice@example.com")).getByRole("button", {
        name: m.providers_account_dialog_title(),
      })
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(m.providers_account_dialog_title())).toBeInTheDocument();
    expect(screen.getAllByText("alice@example.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText("kiro-1").length).toBeGreaterThan(0);
  });

  it("shows tooltip for account details action on hover", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await user.hover(
      within(await findAccountRow("alice@example.com")).getByRole("button", {
        name: m.providers_account_dialog_title(),
      })
    );

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      m.providers_account_dialog_title()
    );
  });

  it("keeps the actions column pinned to the right", async () => {
    render(<ProvidersPanel />);

    const header = await screen.findByRole("columnheader", { name: m.providers_table_actions() });
    const actionButton = within(await findAccountRow("alice@example.com")).getByRole("button", {
      name: m.providers_account_dialog_title(),
    });
    const actionCell = actionButton.closest('[data-slot="table-cell"]');

    expect(header).toHaveClass("sticky", "right-0");
    expect(actionCell).not.toBeNull();
    expect(actionCell).toHaveClass("sticky", "right-0");
  });

  it("refreshes codex account token from account dialog action", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await user.click(
      within(await findAccountRow("bob@example.com")).getByRole("button", {
        name: m.providers_account_dialog_title(),
      })
    );
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: m.common_refresh() }));
    const refreshConfirmDialog = document.querySelector("[data-slot='account-refresh-confirm-dialog']");
    if (!(refreshConfirmDialog instanceof HTMLElement)) {
      throw new Error("Missing account refresh confirm dialog");
    }
    await user.click(within(refreshConfirmDialog).getByRole("button", { name: m.common_refresh() }));

    expect(providerMocks.refreshCodexAccount).toHaveBeenCalledWith("codex-1");
    expect(providerMocks.refreshCodexQuotaCache).toHaveBeenCalledWith(["codex-1"]);
    expect(providerMocks.refreshCodexQuotas).not.toHaveBeenCalled();
  });

  it("shows toast when codex account refresh fails", async () => {
    const user = userEvent.setup();
    providerMocks.refreshCodexAccount.mockRejectedValueOnce(
      new Error("Codex 登录已失效，请重新登录该账户。")
    );

    render(<ProvidersPanel />);

    await user.click(
      within(await findAccountRow("bob@example.com")).getByRole("button", {
        name: m.providers_account_dialog_title(),
      })
    );
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: m.common_refresh() }));
    const refreshConfirmDialog = document.querySelector("[data-slot='account-refresh-confirm-dialog']");
    if (!(refreshConfirmDialog instanceof HTMLElement)) {
      throw new Error("Missing account refresh confirm dialog");
    }
    await user.click(within(refreshConfirmDialog).getByRole("button", { name: m.common_refresh() }));

    expect(providerMocks.toastError).toHaveBeenCalledWith("Codex 登录已失效，请重新登录该账户。");
  });

  it("toggles codex auto refresh in account dialog", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await user.click(
      within(await findAccountRow("bob@example.com")).getByRole("button", {
        name: m.providers_account_dialog_title(),
      })
    );
    const toggle = within(screen.getByRole("dialog")).getByRole("switch", {
      name: m.providers_account_auto_refresh(),
    });
    await user.click(toggle);

    expect(providerMocks.setCodexAutoRefresh).toHaveBeenCalledWith("codex-1", false);
  });

  it("manually refreshes kiro quota from account dialog", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await user.click(
      within(await findAccountRow("alice@example.com")).getByRole("button", {
        name: m.providers_account_dialog_title(),
      })
    );
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Refresh Quota" }));

    expect(providerMocks.refreshKiroQuotaNow).toHaveBeenCalledWith("kiro-1");
  });

  it("manually refreshes codex quota from account dialog", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await user.click(
      within(await findAccountRow("bob@example.com")).getByRole("button", {
        name: m.providers_account_dialog_title(),
      })
    );
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Refresh Quota" }));

    expect(providerMocks.refreshCodexQuotaNow).toHaveBeenCalledWith("codex-1");
  });

  it("refreshes xai account token without probing quota", async () => {
    const user = userEvent.setup();
    providerMocks.listProviderAccountsPage.mockResolvedValueOnce(createXaiAccountsPage());
    render(<ProvidersPanel />);

    await user.click(
      within(await findAccountRow("grok@example.com")).getByRole("button", {
        name: m.providers_account_dialog_title(),
      })
    );
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: m.common_refresh() }));
    const refreshConfirmDialog = document.querySelector("[data-slot='account-refresh-confirm-dialog']");
    if (!(refreshConfirmDialog instanceof HTMLElement)) {
      throw new Error("Missing account refresh confirm dialog");
    }
    await user.click(within(refreshConfirmDialog).getByRole("button", { name: m.common_refresh() }));

    expect(providerMocks.refreshXaiAccount).toHaveBeenCalledWith("xai-1");
    expect(providerMocks.refreshXaiQuotaCache).not.toHaveBeenCalled();
    expect(providerMocks.refreshXaiQuotaNow).not.toHaveBeenCalled();
  });

  it("manually refreshes xai quota from account dialog", async () => {
    const user = userEvent.setup();
    providerMocks.listProviderAccountsPage.mockResolvedValueOnce(createXaiAccountsPage());
    render(<ProvidersPanel />);

    await user.click(
      within(await findAccountRow("grok@example.com")).getByRole("button", {
        name: m.providers_account_dialog_title(),
      })
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: m.providers_account_refresh_quota(),
      })
    );

    expect(providerMocks.refreshXaiQuotaNow).toHaveBeenCalledWith("xai-1");
  });

  it("toggles xai automatic token refresh", async () => {
    const user = userEvent.setup();
    const dialog = await openXaiAccountDialog(user);

    await user.click(
      within(dialog).getByRole("switch", { name: m.providers_account_auto_refresh() }),
    );

    await waitFor(() => {
      expect(providerMocks.setXaiAutoRefresh).toHaveBeenCalledWith("xai-1", false);
    });
  });

  it("disables an xai account", async () => {
    const user = userEvent.setup();
    const dialog = await openXaiAccountDialog(user);

    await user.click(within(dialog).getByRole("button", { name: m.common_disable() }));

    await waitFor(() => {
      expect(providerMocks.setXaiStatus).toHaveBeenCalledWith("xai-1", "disabled");
    });
  });

  it("saves an xai account proxy URL", async () => {
    const user = userEvent.setup();
    const dialog = await openXaiAccountDialog(user);
    const proxyInput = within(dialog).getByLabelText(m.field_proxy_url());

    await user.type(proxyInput, "socks5://127.0.0.1:1080");
    await user.click(
      within(dialog).getByRole("button", { name: m.providers_save_proxy_url() }),
    );

    await waitFor(() => {
      expect(providerMocks.setXaiProxyUrl).toHaveBeenCalledWith(
        "xai-1",
        "socks5://127.0.0.1:1080",
      );
    });
  });

  it("saves an xai account priority", async () => {
    const user = userEvent.setup();
    const dialog = await openXaiAccountDialog(user);
    const priorityInput = within(dialog).getByLabelText(m.field_priority());

    await user.clear(priorityInput);
    await user.type(priorityInput, "12");
    await user.click(
      within(dialog).getByRole("button", { name: m.providers_save_priority() }),
    );

    await waitFor(() => {
      expect(providerMocks.setXaiPriority).toHaveBeenCalledWith("xai-1", 12);
    });
  });

  it("logs out an xai account", async () => {
    const user = userEvent.setup();
    const dialog = await openXaiAccountDialog(user);

    await user.click(within(dialog).getByRole("button", { name: m.xai_account_logout() }));
    const deleteDialog = document.querySelector("[data-slot='account-delete-dialog']");
    if (!(deleteDialog instanceof HTMLElement)) {
      throw new Error("Missing account delete dialog");
    }
    await user.click(within(deleteDialog).getByRole("button", { name: m.common_delete() }));

    await waitFor(() => {
      expect(providerMocks.logoutXai).toHaveBeenCalledWith("xai-1");
      expect(providerMocks.syncXaiDefaultUpstreamConfig).toHaveBeenCalledTimes(1);
    });
  });

  it("disables kiro account from account dialog", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await user.click(
      within(await findAccountRow("alice@example.com")).getByRole("button", {
        name: m.providers_account_dialog_title(),
      })
    );
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Disable" }));

    expect(providerMocks.setKiroStatus).toHaveBeenCalledWith("kiro-1", "disabled");
  });

  it("disables codex account from account dialog", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await user.click(
      within(await findAccountRow("bob@example.com")).getByRole("button", {
        name: m.providers_account_dialog_title(),
      })
    );
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Disable" }));

    expect(providerMocks.setCodexStatus).toHaveBeenCalledWith("codex-1", "disabled");
  });

  it("saves kiro account priority from account dialog", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await user.click(
      within(await findAccountRow("alice@example.com")).getByRole("button", {
        name: m.providers_account_dialog_title(),
      })
    );

    const input = await screen.findByLabelText(m.field_priority());
    await user.clear(input);
    await user.type(input, "12");
    await user.click(screen.getByRole("button", { name: m.providers_save_priority() }));

    expect(providerMocks.setKiroPriority).toHaveBeenCalledWith("kiro-1", 12);
  });

  it("saves codex account priority from account dialog", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await user.click(
      within(await findAccountRow("bob@example.com")).getByRole("button", {
        name: m.providers_account_dialog_title(),
      })
    );

    const input = await screen.findByLabelText(m.field_priority());
    await user.clear(input);
    await user.type(input, "21");
    await user.click(screen.getByRole("button", { name: m.providers_save_priority() }));

    expect(providerMocks.setCodexPriority).toHaveBeenCalledWith("codex-1", 21);
  });

  it("refreshes all provider data from toolbar action", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await user.click(within(getToolbar()).getByRole("button", { name: m.common_refresh() }));

    expect(providerMocks.refreshKiroAccounts).toHaveBeenCalledTimes(1);
    expect(providerMocks.refreshCodexAccounts).toHaveBeenCalledTimes(1);
    expect(providerMocks.refreshXaiAccounts).toHaveBeenCalledTimes(1);
    expect(providerMocks.refreshKiroQuotas).not.toHaveBeenCalled();
    expect(providerMocks.refreshCodexQuotas).not.toHaveBeenCalled();
    expect(providerMocks.refreshXaiQuotaCache).not.toHaveBeenCalled();
    expect(providerMocks.refreshXaiQuotaNow).not.toHaveBeenCalled();
  });

  it("opens add account dialog from toolbar add button", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    expect(within(getToolbar()).getByRole("button", { name: m.providers_add_account() })).toBeInTheDocument();

    await openAddAccountDialog(user);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(getAddLabel())).toBeInTheDocument();
    expect(within(dialog).queryByText(m.config_section_providers_desc())).not.toBeInTheDocument();
    expect(within(dialog).getByText(m.providers_kiro_title())).toBeInTheDocument();
    expect(within(dialog).getByText(m.providers_codex_title())).toBeInTheDocument();
    expect(within(dialog).getByText(m.providers_xai_title())).toBeInTheDocument();
  });

  it("resets login state when closing the add account dialog", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await openAddAccountDialog(user);
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    expect(providerMocks.resetKiroLogin).toHaveBeenCalledTimes(1);
    expect(providerMocks.resetCodexLogin).toHaveBeenCalledTimes(1);
    expect(providerMocks.resetXaiLogin).toHaveBeenCalledTimes(1);
  });

  it("resets login state when dismissing the add account dialog with Escape", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await openAddAccountDialog(user);
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(providerMocks.resetKiroLogin).toHaveBeenCalledTimes(1);
      expect(providerMocks.resetCodexLogin).toHaveBeenCalledTimes(1);
      expect(providerMocks.resetXaiLogin).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps provider choice while open and resets it only after reopening", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);

    await openAddAccountDialog(user);
    await switchAddProviderToCodex(user);
    expect(getAddProviderPanel("codex")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await openAddAccountDialog(user);

    expect(getAddProviderPanel("kiro")).toBeInTheDocument();
  });

  it("starts kiro aws builder id login from toolbar action", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);
    await openAddAccountDialog(user);

    const loginButton = document.querySelector('[data-slot="providers-add-kiro-login-aws"]');
    if (!(loginButton instanceof HTMLButtonElement)) {
      throw new Error("Missing kiro aws login button");
    }

    await user.click(loginButton);

    expect(providerMocks.beginKiroLogin).toHaveBeenCalledWith("aws");
  });

  it("starts kiro google login from toolbar action", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);
    await openAddAccountDialog(user);

    const loginButton = document.querySelector('[data-slot="providers-add-kiro-login-google"]');
    if (!(loginButton instanceof HTMLButtonElement)) {
      throw new Error("Missing kiro google login button");
    }

    await user.click(loginButton);

    expect(providerMocks.beginKiroLogin).toHaveBeenCalledWith("google");
  });

  it("imports kiro ide directory from toolbar action", async () => {
    const user = userEvent.setup();
    vi.mocked(open).mockResolvedValueOnce("/tmp/kiro");

    render(<ProvidersPanel />);
    await openAddAccountDialog(user);

    const importButton = document.querySelector('[data-slot="providers-add-kiro-import-ide"]');
    if (!(importButton instanceof HTMLButtonElement)) {
      throw new Error("Missing kiro import ide button");
    }

    await user.click(importButton);

    expect(open).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
    });
    expect(providerMocks.importKiroIde).toHaveBeenCalledWith("/tmp/kiro");
    expect(providerMocks.refreshKiroQuotaCache).toHaveBeenCalledWith(["kiro-1"]);
    expect(providerMocks.refreshKiroQuotas).not.toHaveBeenCalled();
  });

  it("imports kiro kam json from toolbar action", async () => {
    const user = userEvent.setup();
    vi.mocked(open).mockResolvedValueOnce("/tmp/kiro.json");

    render(<ProvidersPanel />);
    await openAddAccountDialog(user);

    const importButton = document.querySelector('[data-slot="providers-add-kiro-import-kam"]');
    if (!(importButton instanceof HTMLButtonElement)) {
      throw new Error("Missing kiro import kam button");
    }

    await user.click(importButton);

    expect(open).toHaveBeenCalledWith({
      directory: false,
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    expect(providerMocks.importKiroKam).toHaveBeenCalledWith("/tmp/kiro.json");
    expect(providerMocks.refreshKiroQuotaCache).toHaveBeenCalledWith(["kiro-1"]);
    expect(providerMocks.refreshKiroQuotas).not.toHaveBeenCalled();
  });

  it("shows kiro import success toast before post-import refresh finishes", async () => {
    const user = userEvent.setup();
    let resolveRefreshQuota: (() => void) | undefined;
    providerMocks.refreshKiroQuotaCache.mockReturnValueOnce(
      new Promise<undefined>((resolve) => {
        resolveRefreshQuota = () => resolve(undefined);
      })
    );
    vi.mocked(open).mockResolvedValueOnce("/tmp/kiro");

    render(<ProvidersPanel />);
    await openAddAccountDialog(user);

    const importButton = document.querySelector('[data-slot="providers-add-kiro-import-ide"]');
    if (!(importButton instanceof HTMLButtonElement)) {
      throw new Error("Missing kiro import ide button");
    }

    await user.click(importButton);

    await waitFor(() => {
      expect(providerMocks.toastSuccess).toHaveBeenCalledWith(m.kiro_import_success());
    });
    expect(providerMocks.refreshKiroQuotaCache).toHaveBeenCalledWith(["kiro-1"]);

    resolveRefreshQuota?.();
  });

  it("starts codex login from toolbar action", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);
    await openAddAccountDialog(user);
    await switchAddProviderToCodex(user);

    const loginButton = document.querySelector('[data-slot="providers-add-codex-login"]');
    if (!(loginButton instanceof HTMLButtonElement)) {
      throw new Error("Missing codex login button");
    }

    await user.click(loginButton);

    expect(providerMocks.beginCodexLogin).toHaveBeenCalledTimes(1);
  });

  it("imports codex account file from toolbar action", async () => {
    const user = userEvent.setup();
    vi.mocked(open).mockResolvedValueOnce("/tmp/codex-account.json");

    render(<ProvidersPanel />);
    await openAddAccountDialog(user);
    await switchAddProviderToCodex(user);
    await switchCodexMode(user, "file");

    const importButton = document.querySelector('[data-slot="providers-add-codex-import-file"]');
    if (!(importButton instanceof HTMLButtonElement)) {
      throw new Error("Missing codex import file button");
    }

    await user.click(importButton);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith({
      directory: false,
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    expect(providerMocks.importCodexFile).toHaveBeenCalledWith("/tmp/codex-account.json");
    expect(providerMocks.refreshCodexQuotaCache).toHaveBeenCalledWith(["codex-1"]);
    expect(providerMocks.refreshCodexQuotas).not.toHaveBeenCalled();
  });

  it("imports codex account directory from toolbar action", async () => {
    const user = userEvent.setup();
    vi.mocked(open).mockResolvedValueOnce("/tmp/codex-auth");

    render(<ProvidersPanel />);
    await openAddAccountDialog(user);
    await switchAddProviderToCodex(user);
    await switchCodexMode(user, "file");

    const importButton = document.querySelector('[data-slot="providers-add-codex-import-directory"]');
    if (!(importButton instanceof HTMLButtonElement)) {
      throw new Error("Missing codex import directory button");
    }

    await user.click(importButton);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
    });
    expect(providerMocks.importCodexFile).toHaveBeenCalledWith("/tmp/codex-auth");
    expect(providerMocks.refreshCodexQuotaCache).toHaveBeenCalledWith(["codex-1"]);
    expect(providerMocks.refreshCodexQuotas).not.toHaveBeenCalled();
  });

  it("imports codex refresh tokens from manual input", async () => {
    const user = userEvent.setup();

    render(<ProvidersPanel />);
    await openAddAccountDialog(user);
    await switchAddProviderToCodex(user);
    await switchCodexMode(user, "refresh_token");

    const panel = getAddProviderPanel("codex");
    await user.type(
      within(panel).getByRole("textbox"),
      "rt-one\nrt-two"
    );
    await user.click(within(panel).getByRole("button", { name: m.codex_manual_import_button() }));

    expect(providerMocks.importCodexRefreshTokens).toHaveBeenCalledWith("rt-one\nrt-two", "codex");
    expect(providerMocks.refreshCodexQuotaCache).toHaveBeenCalledWith(["codex-1"]);
    expect(open).not.toHaveBeenCalled();
  });

  it("imports codex mobile refresh tokens from manual input", async () => {
    const user = userEvent.setup();

    render(<ProvidersPanel />);
    await openAddAccountDialog(user);
    await switchAddProviderToCodex(user);
    await switchCodexMode(user, "mobile_refresh_token");

    const panel = getAddProviderPanel("codex");
    await user.type(within(panel).getByRole("textbox"), "mobile-rt");
    await user.click(within(panel).getByRole("button", { name: m.codex_manual_import_button() }));

    expect(providerMocks.importCodexRefreshTokens).toHaveBeenCalledWith("mobile-rt", "mobile");
    expect(providerMocks.refreshCodexQuotaCache).toHaveBeenCalledWith(["codex-1"]);
    expect(open).not.toHaveBeenCalled();
  });

  it("imports codex JSON or access token from manual input", async () => {
    const user = userEvent.setup();
    const payload = JSON.stringify({ access_token: "access-token", expires_in: 3600 });

    render(<ProvidersPanel />);
    await openAddAccountDialog(user);
    await switchAddProviderToCodex(user);
    await switchCodexMode(user, "codex_session");

    const panel = getAddProviderPanel("codex");
    fireEvent.change(within(panel).getByRole("textbox"), { target: { value: payload } });
    await user.click(within(panel).getByRole("button", { name: m.codex_manual_import_button() }));

    expect(providerMocks.importCodexText).toHaveBeenCalledWith(payload);
    expect(providerMocks.refreshCodexQuotaCache).toHaveBeenCalledWith(["codex-1"]);
    expect(open).not.toHaveBeenCalled();
  });

  it("shows codex import success toast before post-import refresh finishes", async () => {
    const user = userEvent.setup();
    let resolveRefreshQuota: (() => void) | undefined;
    providerMocks.refreshCodexQuotaCache.mockReturnValueOnce(
      new Promise<undefined>((resolve) => {
        resolveRefreshQuota = () => resolve(undefined);
      })
    );
    vi.mocked(open).mockResolvedValueOnce("/tmp/codex-account.json");

    render(<ProvidersPanel />);
    await openAddAccountDialog(user);
    await switchAddProviderToCodex(user);
    await switchCodexMode(user, "file");

    const importButton = document.querySelector('[data-slot="providers-add-codex-import-file"]');
    if (!(importButton instanceof HTMLButtonElement)) {
      throw new Error("Missing codex import file button");
    }

    await user.click(importButton);

    await waitFor(() => {
      expect(providerMocks.toastSuccess).toHaveBeenCalledWith(m.codex_import_success());
    });
    expect(providerMocks.refreshCodexQuotaCache).toHaveBeenCalledWith(["codex-1"]);

    resolveRefreshQuota?.();
  });

  it("starts xai device login from toolbar action", async () => {
    const user = userEvent.setup();
    render(<ProvidersPanel />);
    await openAddAccountDialog(user);
    await switchAddProviderToXai(user);

    const loginButton = document.querySelector('[data-slot="providers-add-xai-login"]');
    if (!(loginButton instanceof HTMLButtonElement)) {
      throw new Error("Missing xai login button");
    }
    await user.click(loginButton);

    expect(providerMocks.beginXaiLogin).toHaveBeenCalledTimes(1);
  });

  it("imports xai account file and directory without probing quota", async () => {
    const user = userEvent.setup();
    vi.mocked(open)
      .mockResolvedValueOnce("/tmp/xai-account.json")
      .mockResolvedValueOnce("/tmp/xai-auth");

    render(<ProvidersPanel />);
    await openAddAccountDialog(user);
    await switchAddProviderToXai(user);
    await switchXaiMode(user, "file");
    const panel = getAddProviderPanel("xai");

    await user.click(
      within(panel).getByRole("button", { name: m.xai_import_file_button() })
    );
    await user.click(
      within(panel).getByRole("button", { name: m.xai_import_directory_button() })
    );

    expect(open).toHaveBeenNthCalledWith(1, {
      directory: false,
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    expect(open).toHaveBeenNthCalledWith(2, {
      directory: true,
      multiple: false,
      filters: undefined,
    });
    expect(providerMocks.importXaiFile).toHaveBeenNthCalledWith(1, "/tmp/xai-account.json");
    expect(providerMocks.importXaiFile).toHaveBeenNthCalledWith(2, "/tmp/xai-auth");
    expect(providerMocks.syncXaiDefaultUpstreamConfig).toHaveBeenCalledTimes(2);
    expect(providerMocks.refreshXaiQuotaCache).not.toHaveBeenCalled();
    expect(providerMocks.refreshXaiQuotaNow).not.toHaveBeenCalled();
  });

  it("imports xai JSON without probing quota", async () => {
    const user = userEvent.setup();
    const payload = JSON.stringify({ type: "xai", auth_kind: "oauth", refresh_token: "rt" });

    render(<ProvidersPanel />);
    await openAddAccountDialog(user);
    await switchAddProviderToXai(user);
    await switchXaiMode(user, "json");
    const panel = getAddProviderPanel("xai");
    fireEvent.change(within(panel).getByRole("textbox"), { target: { value: payload } });
    await user.click(
      within(panel).getByRole("button", { name: m.xai_manual_import_button() })
    );

    expect(providerMocks.importXaiText).toHaveBeenCalledWith(payload);
    expect(providerMocks.refreshXaiQuotaCache).not.toHaveBeenCalled();
    expect(providerMocks.refreshXaiQuotaNow).not.toHaveBeenCalled();
  });

  it("imports xai refresh tokens without probing quota", async () => {
    const user = userEvent.setup();

    render(<ProvidersPanel />);
    await openAddAccountDialog(user);
    await switchAddProviderToXai(user);
    await switchXaiMode(user, "refresh_token");
    const panel = getAddProviderPanel("xai");
    await user.type(within(panel).getByRole("textbox"), "rt-one\nrt-two");
    await user.click(
      within(panel).getByRole("button", { name: m.xai_manual_import_button() })
    );

    expect(providerMocks.importXaiRefreshTokens).toHaveBeenCalledWith("rt-one\nrt-two");
    expect(providerMocks.refreshXaiQuotaCache).not.toHaveBeenCalled();
    expect(providerMocks.refreshXaiQuotaNow).not.toHaveBeenCalled();
  });

  it("optimistically hides selected rows while batch delete is in progress", async () => {
    const user = userEvent.setup();
    let resolveDelete: ((value: undefined) => void) | undefined;
    const deletePromise = new Promise<undefined>((resolve) => {
      resolveDelete = resolve;
    });
    providerMocks.deleteProviderAccounts.mockReturnValueOnce(deletePromise);

    render(<ProvidersPanel />);
    await screen.findByText("alice@example.com");

    await user.click(within(getAccountsTable()).getByRole("checkbox", { name: "Select all" }));
    await user.click(screen.getByRole("button", { name: `${m.common_delete()}(2)` }));

    const dialog = document.querySelector("[data-slot='accounts-batch-delete-dialog']");
    if (!(dialog instanceof HTMLElement)) {
      throw new Error("Missing accounts batch delete dialog");
    }
    await user.click(within(dialog).getByRole("button", { name: m.common_delete() }));

    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("bob@example.com")).not.toBeInTheDocument();
    expect(screen.getByText(m.providers_accounts_loading())).toBeInTheDocument();

    resolveDelete?.(undefined);
    await waitFor(() => {
      expect(providerMocks.toastSuccess).toHaveBeenCalledWith(
        m.providers_accounts_delete_success({ count: 2 })
      );
    });
  });

  it("keeps codex import enabled while unrelated kiro data is loading", async () => {
    const user = userEvent.setup();
    providerMocks.kiroQuotasLoading = true;
    vi.mocked(open)
      .mockResolvedValueOnce("/tmp/codex-account.json")
      .mockResolvedValueOnce("/tmp/codex-auth");

    render(<ProvidersPanel />);
    await openAddAccountDialog(user);
    await switchAddProviderToCodex(user);
    await switchCodexMode(user, "file");

    const importFileButton = document.querySelector('[data-slot="providers-add-codex-import-file"]');
    if (!(importFileButton instanceof HTMLButtonElement)) {
      throw new Error("Missing codex import file button");
    }
    const importDirectoryButton = document.querySelector('[data-slot="providers-add-codex-import-directory"]');
    if (!(importDirectoryButton instanceof HTMLButtonElement)) {
      throw new Error("Missing codex import directory button");
    }

    expect(importFileButton.disabled).toBe(false);
    expect(importDirectoryButton.disabled).toBe(false);

    await user.click(importFileButton);
    await user.click(importDirectoryButton);

    expect(open).toHaveBeenNthCalledWith(1, {
      directory: false,
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    expect(open).toHaveBeenNthCalledWith(2, {
      directory: true,
      multiple: false,
    });
    expect(providerMocks.importCodexFile).toHaveBeenNthCalledWith(1, "/tmp/codex-account.json");
    expect(providerMocks.importCodexFile).toHaveBeenNthCalledWith(2, "/tmp/codex-auth");
  });

  it("renders unified disabled and cooling down account statuses", async () => {
    setLocale("zh", { reload: false });

    providerMocks.listProviderAccountsPage.mockResolvedValueOnce({
      items: [
        {
          provider_kind: "kiro" as const,
          account_id: "kiro-disabled.json",
          email: "disabled@example.com",
          expires_at: "2026-05-01T00:00:00Z",
          status: "disabled" as const,
          auth_method: "google",
          provider_name: "kiro",
          priority: 0,
          proxy_url: null,
          quota: {
            plan_type: null,
            error: null,
            checked_at: null,
            items: [],
          },
        },
        {
          provider_kind: "codex" as const,
          account_id: "codex-cooling.json",
          email: "cooling@example.com",
          expires_at: "2026-05-01T00:00:00Z",
          status: "cooling_down" as const,
          auth_method: null,
          provider_name: null,
          auto_refresh_enabled: true,
          priority: 0,
          proxy_url: null,
          quota: {
            plan_type: null,
            error: null,
            checked_at: null,
            items: [],
          },
        },
      ],
      total: 2,
      page: 1,
      page_size: 10,
      status_counts: {
        all: 2,
        active: 0,
        disabled: 1,
        expired: 0,
        invalid: 0,
        cooling_down: 1,
      },
    });

    render(<ProvidersPanel />);

    expect(await screen.findByText("disabled@example.com")).toBeInTheDocument();
    expect(screen.getByText("cooling@example.com")).toBeInTheDocument();
    expect(
      within(getAccountsTable()).getByText(m.kiro_account_status_disabled({}, { locale: "zh" }))
    ).toBeInTheDocument();
    expect(
      within(getAccountsTable()).getByText(
        m.providers_account_status_cooling_down({}, { locale: "zh" })
      ),
    ).toBeInTheDocument();
  });
});
