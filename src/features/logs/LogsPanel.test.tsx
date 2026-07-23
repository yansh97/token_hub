import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardViewStateProvider } from "@/features/dashboard/state";
import type { DashboardSnapshotQuery } from "@/features/dashboard/types";
import { LogsPanel } from "@/features/logs/LogsPanel";
import type { RequestLogDetail } from "@/features/logs/types";

vi.mock("@/features/dashboard/components/data-table", () => ({
  DataTable: ({
    items,
    onSelectItem,
  }: {
    items: Array<{
      id: number;
      upstreamId: string;
      provider: string;
      accountId?: string | null;
    }>;
    onSelectItem?: (item: {
      id: number;
      upstreamId: string;
      provider: string;
      accountId?: string | null;
    }) => void;
  }) => (
    <div data-testid="logs-items">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelectItem?.(item)}
        >
          {[item.upstreamId, item.provider, item.accountId]
            .filter(Boolean)
            .join(" · ")}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi
    .fn<
      (
        event: string,
        handler: (payload: {
          payload: { enabled: boolean; expiresAtMs: number | null };
        }) => void,
      ) => Promise<() => void>
    >()
    .mockResolvedValue(() => undefined),
}));

const {
  readDashboardSnapshotMock,
  refreshDashboardModelDiscoveryMock,
  readRequestDetailCaptureMock,
  setRequestDetailCaptureMock,
  readRequestLogDetailMock,
} = vi.hoisted(() => ({
  readDashboardSnapshotMock: vi.fn(),
  refreshDashboardModelDiscoveryMock: vi.fn(),
  readRequestDetailCaptureMock: vi.fn(),
  setRequestDetailCaptureMock: vi.fn(),
  readRequestLogDetailMock: vi.fn(),
}));

vi.mock("@/features/dashboard/api", () => ({
  readDashboardSnapshot: readDashboardSnapshotMock,
  refreshDashboardModelDiscovery: refreshDashboardModelDiscoveryMock,
}));

vi.mock("@/features/logs/api", () => ({
  readRequestDetailCapture: readRequestDetailCaptureMock,
  setRequestDetailCapture: setRequestDetailCaptureMock,
  readRequestLogDetail: readRequestLogDetailMock,
}));

function renderPanel() {
  return render(<LogsPanel />, { wrapper: DashboardViewStateProvider });
}

function createRequestLogDetail(
  patch: Partial<RequestLogDetail> = {},
): RequestLogDetail {
  return {
    id: 1,
    tsMs: 100,
    clientIp: null,
    path: "/v1/chat/completions",
    provider: "codex",
    upstreamId: "alpha",
    accountId: "codex-a.json",
    model: "gpt-5",
    mappedModel: null,
    stream: false,
    status: 200,
    inputTokens: 10,
    outputTokens: 20,
    imageOutputTokens: null,
    totalTokens: 30,
    cachedTokens: 5,
    costNanoUsd: 1_210_000_000,
    pricingVersion: "2026-05-02.openai-openrouter-v1",
    pricingModel: "gpt-5.5",
    pricingContextTier: "short",
    clientRequestId: "client-request-1",
    attemptIndex: 0,
    isBillable: true,
    latencyMs: 30,
    upstreamResponseHeadersMs: 10,
    upstreamFirstBodyChunkMs: 12,
    firstClientFlushMs: 20,
    firstOutputMs: 30,
    upstreamRequestId: "req-1",
    usageJson: null,
    requestHeaders: null,
    requestBody: null,
    responseBody: null,
    responseError: null,
    ...patch,
  };
}

describe("logs/LogsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    readDashboardSnapshotMock.mockReset();
    refreshDashboardModelDiscoveryMock.mockReset();
    readRequestDetailCaptureMock.mockReset();
    setRequestDetailCaptureMock.mockReset();
    readRequestLogDetailMock.mockReset();

    refreshDashboardModelDiscoveryMock.mockResolvedValue(undefined);
    readRequestDetailCaptureMock.mockResolvedValue({
      enabled: false,
      expiresAtMs: null,
    });
    setRequestDetailCaptureMock.mockResolvedValue({
      enabled: false,
      expiresAtMs: null,
    });
    readRequestLogDetailMock.mockResolvedValue(createRequestLogDetail());
    readDashboardSnapshotMock.mockImplementation(
      async ({ upstreamId, accountId, publicOnly }: DashboardSnapshotQuery) => {
        const base = {
          providers: [
            {
              provider: "openai",
              requests: 1,
              totalTokens: 30,
              cachedTokens: 5,
            },
            {
              provider: "anthropic",
              requests: 1,
              totalTokens: 7,
              cachedTokens: 1,
            },
            {
              provider: "openai-response",
              requests: 1,
              totalTokens: 5,
              cachedTokens: 1,
            },
          ],
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
              cachedTokens: 1,
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
              accountId: null,
              requests: 1,
              totalTokens: 7,
              cachedTokens: 1,
            },
          ],
          series: [],
          models: [],
          modelOptions: ["gpt-5", "claude"],
          modelProbes: [],
          truncated: false,
        };

        if (upstreamId === "alpha" && accountId === "codex-a.json") {
          return {
            ...base,
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
            recent: [
              {
                id: 1,
                tsMs: 100,
                clientIp: null,
                path: "/v1/chat/completions",
                provider: "openai",
                upstreamId: "alpha",
                accountId: "codex-a.json",
                model: "gpt-5",
                mappedModel: null,
                stream: false,
                status: 200,
                totalTokens: 30,
                cachedTokens: 5,
                latencyMs: 30,
                upstreamRequestId: null,
              },
            ],
          };
        }

        if (upstreamId === "alpha" && publicOnly) {
          return {
            ...base,
            summary: {
              totalRequests: 1,
              successRequests: 1,
              errorRequests: 0,
              costNanoUsd: 0,
              totalTokens: 5,
              inputTokens: 2,
              outputTokens: 3,
              cachedTokens: 1,
              avgLatencyMs: 40,
              medianLatencyMs: 40,
            },
            recent: [
              {
                id: 3,
                tsMs: 110,
                clientIp: null,
                path: "/v1/responses",
                provider: "openai-response",
                upstreamId: "alpha",
                accountId: null,
                model: "gpt-5",
                mappedModel: null,
                stream: false,
                status: 200,
                totalTokens: 5,
                cachedTokens: 1,
                latencyMs: 40,
                upstreamRequestId: null,
              },
            ],
          };
        }

        if (upstreamId === "alpha") {
          return {
            ...base,
            summary: {
              totalRequests: 2,
              successRequests: 2,
              errorRequests: 0,
              costNanoUsd: 0,
              totalTokens: 35,
              inputTokens: 12,
              outputTokens: 23,
              cachedTokens: 6,
              avgLatencyMs: 35,
              medianLatencyMs: 35,
            },
            recent: [
              {
                id: 1,
                tsMs: 100,
                clientIp: null,
                path: "/v1/chat/completions",
                provider: "openai",
                upstreamId: "alpha",
                accountId: "codex-a.json",
                model: "gpt-5",
                mappedModel: null,
                stream: false,
                status: 200,
                totalTokens: 30,
                cachedTokens: 5,
                latencyMs: 30,
                upstreamRequestId: null,
              },
              {
                id: 3,
                tsMs: 110,
                clientIp: null,
                path: "/v1/responses",
                provider: "openai-response",
                upstreamId: "alpha",
                accountId: null,
                model: "gpt-5",
                mappedModel: null,
                stream: false,
                status: 200,
                totalTokens: 5,
                cachedTokens: 1,
                latencyMs: 40,
                upstreamRequestId: null,
              },
            ],
          };
        }

        return {
          ...base,
          summary: {
            totalRequests: 3,
            successRequests: 2,
            errorRequests: 1,
            costNanoUsd: 0,
            totalTokens: 42,
            inputTokens: 15,
            outputTokens: 27,
            cachedTokens: 7,
            avgLatencyMs: 53,
            medianLatencyMs: 40,
          },
          recent: [
            {
              id: 1,
              tsMs: 100,
              clientIp: null,
              path: "/v1/chat/completions",
              provider: "openai",
              upstreamId: "alpha",
              accountId: "codex-a.json",
              model: "gpt-5",
              mappedModel: null,
              stream: false,
              status: 200,
              totalTokens: 30,
              cachedTokens: 5,
              latencyMs: 30,
              upstreamRequestId: null,
            },
            {
              id: 3,
              tsMs: 110,
              clientIp: null,
              path: "/v1/responses",
              provider: "openai-response",
              upstreamId: "alpha",
              accountId: null,
              model: "gpt-5",
              mappedModel: null,
              stream: false,
              status: 200,
              totalTokens: 5,
              cachedTokens: 1,
              latencyMs: 40,
              upstreamRequestId: null,
            },
            {
              id: 2,
              tsMs: 120,
              clientIp: null,
              path: "/v1/messages",
              provider: "anthropic",
              upstreamId: "beta",
              accountId: null,
              model: "claude",
              mappedModel: null,
              stream: false,
              status: 500,
              totalTokens: 7,
              cachedTokens: 1,
              latencyMs: 90,
              upstreamRequestId: null,
            },
          ],
        };
      },
    );
  });

  it("shows all upstream logs by default and narrows the table after switching upstream", async () => {
    const user = userEvent.setup();

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("logs-items")).toHaveTextContent(
        "alpha · openai · codex-a.json",
      );
      expect(screen.getByTestId("logs-items")).toHaveTextContent(
        "alpha · openai-response",
      );
      expect(screen.getByTestId("logs-items")).toHaveTextContent(
        "beta · anthropic",
      );
    });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "提供商" }),
      "alpha",
    );

    await waitFor(() => {
      expect(screen.getByTestId("logs-items")).toHaveTextContent("alpha");
    });
    expect(readDashboardSnapshotMock).toHaveBeenLastCalledWith({
      range: { fromTsMs: expect.any(Number), toTsMs: expect.any(Number) },
      offset: 0,
      upstreamId: "alpha",
      model: null,
    });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "模型" }),
      "gpt-5",
    );

    await waitFor(() => {
      expect(readDashboardSnapshotMock).toHaveBeenLastCalledWith({
        range: { fromTsMs: expect.any(Number), toTsMs: expect.any(Number) },
        offset: 0,
        upstreamId: "alpha",
        model: "gpt-5",
      });
    });
  });

  it("refreshes logs without refreshing dashboard model discovery", async () => {
    const user = userEvent.setup();

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("logs-items")).toHaveTextContent(
        "alpha · openai · codex-a.json",
      );
    });
    expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "刷新" }));

    await waitFor(() => {
      expect(readDashboardSnapshotMock).toHaveBeenCalledTimes(2);
    });
    expect(refreshDashboardModelDiscoveryMock).not.toHaveBeenCalled();
  });

  it("starts fixed request detail capture without permanent mode", async () => {
    const user = userEvent.setup();
    setRequestDetailCaptureMock.mockResolvedValueOnce({
      enabled: true,
      expiresAtMs: Date.now() + 600_000,
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("logs-items")).toHaveTextContent("alpha");
    });
    expect(screen.queryByText("记录请求详情")).not.toBeInTheDocument();
    expect(screen.queryByText("Permanent")).not.toBeInTheDocument();
    expect(screen.queryByText("永久")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "记录 10 分钟请求详情" }),
    );

    await waitFor(() => {
      expect(setRequestDetailCaptureMock).toHaveBeenCalledWith(true);
    });
    expect(setRequestDetailCaptureMock).toHaveBeenCalledTimes(1);
  });

  it("splits the provider id from the interface format", async () => {
    const user = userEvent.setup();

    renderPanel();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "alpha · openai · codex-a.json" }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "alpha · openai · codex-a.json" }),
    );

    await waitFor(() => {
      expect(readRequestLogDetailMock).toHaveBeenCalledWith(1);
    });

    const providerValues = await screen.findAllByText("alpha");
    expect(providerValues.length).toBeGreaterThan(0);
    expect(screen.getByText("接口格式")).toBeInTheDocument();
    expect(screen.getByText("codex")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "复制全部" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "用量详情" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "请求头" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "请求体" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "错误响应" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the latest selected request detail when an older response resolves later", async () => {
    const user = userEvent.setup();
    let resolveFirst: ((value: RequestLogDetail) => void) | null = null;
    let resolveThird: ((value: RequestLogDetail) => void) | null = null;
    const firstDetailPromise = new Promise<RequestLogDetail>((resolve) => {
      resolveFirst = resolve;
    });
    const thirdDetailPromise = new Promise<RequestLogDetail>((resolve) => {
      resolveThird = resolve;
    });

    readRequestLogDetailMock.mockImplementation((id: number) => {
      if (id === 1) {
        return firstDetailPromise;
      }
      if (id === 3) {
        return thirdDetailPromise;
      }
      return Promise.reject(new Error(`unexpected request log id: ${id}`));
    });

    renderPanel();

    const firstRow = await screen.findByRole("button", {
      name: "alpha · openai · codex-a.json",
    });
    const thirdRow = await screen.findByRole("button", {
      name: "alpha · openai-response",
    });

    await user.click(firstRow);
    await user.click(screen.getByRole("button", { name: "关闭" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await user.click(thirdRow);

    await waitFor(() => {
      expect(readRequestLogDetailMock).toHaveBeenNthCalledWith(1, 1);
      expect(readRequestLogDetailMock).toHaveBeenNthCalledWith(2, 3);
    });

    await act(async () => {
      // biome-ignore lint/style/noNonNullAssertion: The preceding wait registers this deferred resolver.
      resolveThird!(
        createRequestLogDetail({
          id: 3,
          path: "/v1/responses",
          provider: "openai-response",
          accountId: null,
          model: "latest-response-model",
          status: 201,
          totalTokens: 5,
          cachedTokens: 1,
          upstreamRequestId: "req-3",
        }),
      );
      await thirdDetailPromise;
    });

    expect(
      await screen.findByText("latest-response-model"),
    ).toBeInTheDocument();
    expect(screen.getByText("OpenAI Responses")).toBeInTheDocument();

    await act(async () => {
      // biome-ignore lint/style/noNonNullAssertion: The preceding wait registers this deferred resolver.
      resolveFirst!(
        createRequestLogDetail({
          model: "stale-chat-model",
          upstreamRequestId: "req-stale",
        }),
      );
      await firstDetailPromise;
    });

    expect(screen.getByText("latest-response-model")).toBeInTheDocument();
    expect(screen.queryByText("stale-chat-model")).not.toBeInTheDocument();
    expect(screen.queryByText("req-stale")).not.toBeInTheDocument();
  });

  it("shows useful pricing metadata without the internal pricing version", async () => {
    const user = userEvent.setup();

    renderPanel();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "alpha · openai · codex-a.json" }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "alpha · openai · codex-a.json" }),
    );

    await waitFor(() => {
      expect(readRequestLogDetailMock).toHaveBeenCalledWith(1);
    });

    expect(await screen.findByText("费用")).toBeInTheDocument();
    expect(screen.getByText("$1.21")).toBeInTheDocument();
    expect(screen.getByText("计费模型")).toBeInTheDocument();
    expect(screen.getByText("gpt-5.5")).toBeInTheDocument();
    expect(screen.queryByText("计费档位")).not.toBeInTheDocument();
    expect(screen.queryByText("上游请求 ID")).not.toBeInTheDocument();
    expect(screen.queryByText("req-1")).not.toBeInTheDocument();
    expect(
      screen.queryByText("2026-05-02.openai-openrouter-v1"),
    ).not.toBeInTheDocument();
  });

  it("keeps image token data in usage detail without a duplicate field", async () => {
    const user = userEvent.setup();
    readRequestLogDetailMock.mockResolvedValueOnce(
      createRequestLogDetail({
        outputTokens: 9,
        imageOutputTokens: 9,
        totalTokens: 14,
        usageJson:
          '{"input_tokens":5,"output_tokens":9,"output_tokens_details":{"image_tokens":9}}',
      }),
    );

    renderPanel();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "alpha · openai · codex-a.json" }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "alpha · openai · codex-a.json" }),
    );

    await waitFor(() => {
      expect(readRequestLogDetailMock).toHaveBeenCalledWith(1);
    });

    expect(screen.queryByText("图片 Token 数")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "用量详情" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("用量详情 (JSON)")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        '{"input_tokens":5,"output_tokens":9,"output_tokens_details":{"image_tokens":9}}',
      ),
    ).toBeInTheDocument();
  });

  it("preserves unknown interface formats and categorizes other status codes", async () => {
    const user = userEvent.setup();
    readRequestLogDetailMock.mockResolvedValueOnce(
      createRequestLogDetail({
        clientIp: "2001:db8::1",
        provider: "future-format",
        upstreamId: "custom",
        accountId: null,
        stream: true,
        status: 429,
      }),
    );

    renderPanel();

    await user.click(
      await screen.findByRole("button", {
        name: "alpha · openai · codex-a.json",
      }),
    );

    expect(await screen.findByText("custom")).toBeInTheDocument();
    expect(screen.getByText("future-format")).toBeInTheDocument();
    expect(screen.getByText("2001:db8::1")).toBeInTheDocument();
    expect(screen.getByText("流式")).toBeInTheDocument();
    expect(screen.getByText("429 客户端错误")).toBeInTheDocument();
  });

  it("shows response body when available", async () => {
    const user = userEvent.setup();
    readRequestLogDetailMock.mockResolvedValueOnce({
      id: 1,
      tsMs: 100,
      clientIp: null,
      path: "/v1/chat/completions",
      provider: "codex",
      upstreamId: "alpha",
      accountId: "codex-a.json",
      model: "gpt-5",
      mappedModel: null,
      stream: false,
      status: 200,
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      cachedTokens: 5,
      costNanoUsd: 1_210_000_000,
      pricingVersion: "2026-05-08.openai-openrouter-v2",
      pricingModel: "gpt-5.5",
      pricingContextTier: "short",
      latencyMs: 30,
      upstreamRequestId: "req-1",
      usageJson: null,
      requestHeaders: null,
      requestBody: null,
      responseBody: '{"id":"resp_1","status":"completed"}',
      responseError: null,
    });

    renderPanel();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "alpha · openai · codex-a.json" }),
      ).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: "alpha · openai · codex-a.json" }),
    );
    await waitFor(() => {
      expect(readRequestLogDetailMock).toHaveBeenCalledWith(1);
    });
    expect(
      await screen.findByText('{"id":"resp_1","status":"completed"}'),
    ).toBeInTheDocument();
  });

  it("shows response error when logged response body is blank", async () => {
    const user = userEvent.setup();
    readRequestLogDetailMock.mockResolvedValueOnce({
      id: 1,
      tsMs: 100,
      clientIp: null,
      path: "/v1/chat/completions",
      provider: "codex",
      upstreamId: "alpha",
      accountId: "codex-a.json",
      model: "gpt-5",
      mappedModel: null,
      stream: false,
      status: 502,
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      cachedTokens: 5,
      costNanoUsd: 1_210_000_000,
      pricingVersion: "2026-05-08.openai-openrouter-v2",
      pricingModel: "gpt-5.5",
      pricingContextTier: "short",
      latencyMs: 30,
      upstreamRequestId: "req-1",
      usageJson: null,
      requestHeaders: null,
      requestBody: null,
      responseBody: "   ",
      responseError: "HTTP 502: upstream quota denied",
    });

    renderPanel();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "alpha · openai · codex-a.json" }),
      ).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: "alpha · openai · codex-a.json" }),
    );
    await waitFor(() => {
      expect(readRequestLogDetailMock).toHaveBeenCalledWith(1);
    });

    expect(
      await screen.findByText("HTTP 502: upstream quota denied"),
    ).toBeInTheDocument();
  });
});
