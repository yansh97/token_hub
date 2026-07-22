import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DASHBOARD_AUTO_REFRESH_INTERVAL_MS,
  useDashboardSnapshot,
} from "@/features/dashboard/snapshot";
import { DashboardViewStateProvider } from "@/features/dashboard/state";
import type { DashboardSnapshot } from "@/features/dashboard/types";

const { readDashboardSnapshotMock, refreshDashboardModelDiscoveryMock } =
  vi.hoisted(() => ({
    readDashboardSnapshotMock: vi.fn(),
    refreshDashboardModelDiscoveryMock: vi.fn(),
  }));

vi.mock("@/features/dashboard/api", () => ({
  readDashboardSnapshot: readDashboardSnapshotMock,
  refreshDashboardModelDiscovery: refreshDashboardModelDiscoveryMock,
}));

function createSnapshot(
  overrides: Partial<DashboardSnapshot> = {},
): DashboardSnapshot {
  return {
    summary: {
      totalRequests: 2,
      successRequests: 1,
      errorRequests: 1,
      costNanoUsd: 0,
      totalTokens: 37,
      inputTokens: 13,
      outputTokens: 24,
      cachedTokens: 5,
      avgLatencyMs: 60,
      medianLatencyMs: 55,
    },
    providers: [
      { provider: "openai", requests: 1, totalTokens: 30, cachedTokens: 5 },
      { provider: "anthropic", requests: 1, totalTokens: 7, cachedTokens: 0 },
    ],
    models: [],
    modelOptions: ["gpt-5", "claude"],
    upstreams: [
      {
        upstreamId: "alpha",
        requests: 2,
        totalTokens: 35,
        cachedTokens: 6,
      },
      {
        upstreamId: "beta",
        requests: 1,
        totalTokens: 7,
        cachedTokens: 0,
      },
    ],
    accounts: [
      {
        upstreamId: "alpha",
        accountId: "codex-a.json",
        requests: 1,
        totalTokens: 30,
        cachedTokens: 5,
      },
      {
        upstreamId: "alpha",
        accountId: null,
        requests: 1,
        totalTokens: 5,
        cachedTokens: 1,
      },
      {
        upstreamId: "beta",
        accountId: "claude-a.json",
        requests: 1,
        totalTokens: 7,
        cachedTokens: 0,
      },
    ],
    series: [],
    recent: [],
    modelProbes: [],
    truncated: false,
    ...overrides,
  };
}

function HookHarness() {
  const {
    snapshot,
    selectedUpstreamId,
    selectedModel,
    onUpstreamChange,
    onModelChange,
    refresh,
  } = useDashboardSnapshot({ refreshModelDiscoveryOnRefresh: true });

  return (
    <div>
      <div data-testid="selected-upstream">{selectedUpstreamId ?? "all"}</div>
      <div data-testid="selected-model">{selectedModel ?? "all"}</div>
      <div data-testid="upstream-options">
        {snapshot?.upstreams.map((item) => item.upstreamId).join(",") ?? ""}
      </div>
      <button type="button" onClick={() => onUpstreamChange("alpha")}>
        filter-alpha
      </button>
      <button type="button" onClick={refresh}>
        refresh-dashboard
      </button>
      <button type="button" onClick={() => onModelChange("gpt-5")}>
        filter-gpt-5
      </button>
    </div>
  );
}

function AutoRefreshHarness({ enabled = true }: { enabled?: boolean }) {
  useDashboardSnapshot({ autoRefreshEnabled: enabled });
  return null;
}

function renderWithViewState(ui: React.ReactNode) {
  return render(ui, { wrapper: DashboardViewStateProvider });
}

describe("dashboard/useDashboardSnapshot", () => {
  beforeEach(() => {
    readDashboardSnapshotMock.mockReset();
    refreshDashboardModelDiscoveryMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("loads all upstreams by default and refetches with the selected upstream", async () => {
    readDashboardSnapshotMock
      .mockResolvedValueOnce(createSnapshot())
      .mockResolvedValueOnce(
        createSnapshot({
          summary: {
            totalRequests: 1,
            successRequests: 1,
            errorRequests: 0,
            costNanoUsd: 0,
            totalTokens: 30,
            inputTokens: 10,
            outputTokens: 20,
            cachedTokens: 5,
            avgLatencyMs: 30,
            medianLatencyMs: 30,
          },
          providers: [
            {
              provider: "openai",
              requests: 1,
              totalTokens: 30,
              cachedTokens: 5,
            },
          ],
          accounts: [
            {
              upstreamId: "alpha",
              accountId: "codex-a.json",
              requests: 1,
              totalTokens: 30,
              cachedTokens: 5,
            },
            {
              upstreamId: "alpha",
              accountId: null,
              requests: 1,
              totalTokens: 5,
              cachedTokens: 1,
            },
          ],
          recent: [
            {
              id: 1,
              tsMs: 100,
              clientIp: null,
              path: "/v1/chat/completions",
              provider: "openai",
              upstreamId: "alpha",
              model: "gpt-4.1",
              mappedModel: null,
              stream: false,
              status: 200,
              totalTokens: 30,
              outputTokens: 20,
              cachedTokens: 5,
              costNanoUsd: null,
              pricingVersion: null,
              pricingModel: null,
              pricingContextTier: null,
              latencyMs: 30,
              upstreamRequestId: "req-alpha",
            },
          ],
        }),
      );

    renderWithViewState(<HookHarness />);

    await waitFor(() => {
      expect(readDashboardSnapshotMock).toHaveBeenNthCalledWith(1, {
        range: {
          fromTsMs: expect.any(Number),
          toTsMs: expect.any(Number),
        },
        offset: 0,
        upstreamId: null,
        model: null,
      });
    });

    expect(screen.getByTestId("selected-upstream")).toHaveTextContent("all");
    expect(screen.getByTestId("upstream-options")).toHaveTextContent(
      "alpha,beta",
    );

    fireEvent.click(screen.getByRole("button", { name: "filter-alpha" }));

    await waitFor(() => {
      expect(readDashboardSnapshotMock).toHaveBeenNthCalledWith(2, {
        range: {
          fromTsMs: expect.any(Number),
          toTsMs: expect.any(Number),
        },
        offset: 0,
        upstreamId: "alpha",
        model: null,
      });
    });

    expect(screen.getByTestId("selected-upstream")).toHaveTextContent("alpha");
  });

  it("refetches with the selected model", async () => {
    readDashboardSnapshotMock
      .mockResolvedValueOnce(createSnapshot())
      .mockResolvedValueOnce(createSnapshot());

    renderWithViewState(<HookHarness />);

    await waitFor(() => {
      expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole("button", { name: "filter-gpt-5" }));

    await waitFor(() => {
      expect(readDashboardSnapshotMock).toHaveBeenLastCalledWith({
        range: {
          fromTsMs: expect.any(Number),
          toTsMs: expect.any(Number),
        },
        offset: 0,
        upstreamId: null,
        model: "gpt-5",
      });
    });
    expect(screen.getByTestId("selected-model")).toHaveTextContent("gpt-5");
  });

  it("refreshes the snapshot before and after manual model discovery", async () => {
    let finishModelDiscovery: (() => void) | undefined;
    readDashboardSnapshotMock
      .mockResolvedValueOnce(createSnapshot())
      .mockResolvedValueOnce(createSnapshot())
      .mockResolvedValueOnce(createSnapshot());
    refreshDashboardModelDiscoveryMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishModelDiscovery = resolve;
        }),
    );

    renderWithViewState(<HookHarness />);

    await waitFor(() => {
      expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(1);
    });
    expect(refreshDashboardModelDiscoveryMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "refresh-dashboard" }));

    await waitFor(() => {
      expect(refreshDashboardModelDiscoveryMock).toHaveBeenCalledTimes(1);
      expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(2);
    });
    expect(readDashboardSnapshotMock.mock.invocationCallOrder[1]).toBeLessThan(
      refreshDashboardModelDiscoveryMock.mock.invocationCallOrder[0],
    );

    finishModelDiscovery?.();

    await waitFor(() => {
      expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(3);
    });
    expect(
      refreshDashboardModelDiscoveryMock.mock.invocationCallOrder[0],
    ).toBeLessThan(readDashboardSnapshotMock.mock.invocationCallOrder[2]);
  });

  it("uses the latest filters after manual model discovery", async () => {
    let finishModelDiscovery: (() => void) | undefined;
    readDashboardSnapshotMock.mockResolvedValue(createSnapshot());
    refreshDashboardModelDiscoveryMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishModelDiscovery = resolve;
        }),
    );

    renderWithViewState(<HookHarness />);

    await waitFor(() => {
      expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole("button", { name: "refresh-dashboard" }));

    await waitFor(() => {
      expect(refreshDashboardModelDiscoveryMock).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole("button", { name: "filter-alpha" }));

    await waitFor(() => {
      expect(readDashboardSnapshotMock).toHaveBeenLastCalledWith({
        range: {
          fromTsMs: expect.any(Number),
          toTsMs: expect.any(Number),
        },
        offset: 0,
        upstreamId: "alpha",
        model: null,
      });
    });

    finishModelDiscovery?.();

    await waitFor(() => {
      expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(4);
    });
    expect(readDashboardSnapshotMock).toHaveBeenLastCalledWith({
      range: {
        fromTsMs: expect.any(Number),
        toTsMs: expect.any(Number),
      },
      offset: 0,
      upstreamId: "alpha",
      model: null,
    });
  });

  it("auto-refreshes only while the document is visible and focused", async () => {
    vi.useFakeTimers();
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState",
    );
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    readDashboardSnapshotMock.mockResolvedValue(createSnapshot());

    const view = renderWithViewState(<AutoRefreshHarness />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_AUTO_REFRESH_INTERVAL_MS);
    });
    expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(2);
    expect(refreshDashboardModelDiscoveryMock).not.toHaveBeenCalled();

    view.rerender(<AutoRefreshHarness enabled={false} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_AUTO_REFRESH_INTERVAL_MS);
    });
    expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(2);

    view.rerender(<AutoRefreshHarness />);

    hasFocus.mockReturnValue(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_AUTO_REFRESH_INTERVAL_MS);
    });
    expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(2);

    hasFocus.mockReturnValue(true);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_AUTO_REFRESH_INTERVAL_MS);
    });
    expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_AUTO_REFRESH_INTERVAL_MS);
    });
    expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(2);

    if (visibilityDescriptor) {
      Object.defineProperty(document, "visibilityState", visibilityDescriptor);
    }
  });

  it("refreshes immediately when the document becomes active again", async () => {
    vi.useFakeTimers();
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState",
    );
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    readDashboardSnapshotMock.mockResolvedValue(createSnapshot());

    renderWithViewState(<AutoRefreshHarness />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(1);

    hasFocus.mockReturnValue(false);
    fireEvent.blur(window);
    hasFocus.mockReturnValue(true);
    fireEvent.focus(window);

    expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    fireEvent(document, new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    fireEvent(document, new Event("visibilitychange"));

    expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(3);
    expect(refreshDashboardModelDiscoveryMock).not.toHaveBeenCalled();

    if (visibilityDescriptor) {
      Object.defineProperty(document, "visibilityState", visibilityDescriptor);
    }
  });
});
