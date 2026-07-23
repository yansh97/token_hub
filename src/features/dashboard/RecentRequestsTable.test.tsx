import { cleanup, render, screen } from "@testing-library/react";
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
