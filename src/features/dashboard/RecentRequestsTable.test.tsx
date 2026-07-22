import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecentRequestsTable } from "@/features/dashboard/RecentRequestsTable";
import type { DashboardRequestItem } from "@/features/dashboard/types";

const item: DashboardRequestItem = {
  id: 1,
  tsMs: 1_000,
  clientIp: null,
  path: "/v1/responses",
  provider: "openai-response",
  upstreamId: "alpha",
  accountId: "codex-a.json",
  model: "gpt-5.6-sol",
  mappedModel: "gpt-5.6-terra",
  stream: true,
  status: 200,
  totalTokens: 45_500,
  outputTokens: 1_600,
  cachedTokens: 43_400,
  costNanoUsd: 4_330_000_000,
  pricingVersion: "catalog.v1",
  pricingModel: "gpt-5.6-sol",
  pricingContextTier: "long",
  latencyMs: 2_742,
  upstreamResponseHeadersMs: 2_031,
  upstreamFirstBodyChunkMs: 2_032,
  firstClientFlushMs: 2_741,
  firstOutputMs: 2_742,
  upstreamRequestId: "req-1",
};

afterEach(cleanup);

describe("dashboard/RecentRequestsTable", () => {
  it("renders a semantic native table", () => {
    render(<RecentRequestsTable items={[item]} />);

    expect(screen.getByRole("table")).toHaveClass("w-full", "table-fixed");
    expect(screen.getByRole("table")).not.toHaveClass("min-w-[980px]");
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "时间",
      "路径",
      "提供商",
      "模型",
      "状态",
      "Tokens",
      "费用",
      "响应头",
    ]);
    for (const header of screen.getAllByRole("columnheader")) {
      expect(header).toHaveClass(
        "bg-background",
        "shadow-[inset_0_-1px_0_var(--border)]",
      );
    }
  });

  it("keeps full values in native titles while showing compact cells", () => {
    render(<RecentRequestsTable items={[item]} />);

    const row = screen.getAllByRole("row")[1];
    expect(row).toBeTruthy();
    const cells = within(row).getAllByRole("cell");
    expect(cells[0]).toHaveAttribute("title");
    expect(cells[1]).toHaveTextContent("/v1/responses");
    expect(cells[2]).toHaveTextContent("alpha");
    expect(cells[2]).toHaveAttribute("title", "alpha · openai-response");
    expect(cells[3]).toHaveTextContent("gpt-5.6-sol");
    expect(cells[3]).toHaveTextContent("gpt-5.6-terra");
  });

  it("shows token, cost, and timing summaries", () => {
    render(<RecentRequestsTable items={[item]} />);

    expect(screen.getByText("45.5K")).toBeInTheDocument();
    expect(screen.getByText("输出 1.6K · 缓存 43.4K")).toBeInTheDocument();
    expect(screen.getByText("4.33")).toHaveAttribute(
      "title",
      expect.stringContaining("计费模型: gpt-5.6-sol"),
    );
    expect(screen.getByText("2,031")).toHaveAttribute(
      "title",
      expect.stringContaining("总耗时: 2,742 ms"),
    );
  });

  it("opens an interactive row with mouse or keyboard", async () => {
    const user = userEvent.setup();
    const onSelectItem = vi.fn();
    render(<RecentRequestsTable items={[item]} onSelectItem={onSelectItem} />);

    const row = screen.getByRole("button");
    await user.click(row);
    expect(onSelectItem).toHaveBeenLastCalledWith(item);

    row.focus();
    await user.keyboard("{Enter}");
    expect(onSelectItem).toHaveBeenCalledTimes(2);
  });
});
