import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SectionCards } from "@/features/dashboard/components/section-cards";
import type { DashboardSummary } from "@/features/dashboard/types";

const summary: DashboardSummary = {
  totalRequests: 10,
  successRequests: 8,
  errorRequests: 2,
  costNanoUsd: 1_210_000_000,
  totalTokens: 210_000,
  inputTokens: 200_000,
  outputTokens: 10_000,
  cachedTokens: 20_000,
  cacheReadTokens: 15_000,
  cacheWriteTokens: 5_000,
  avgLatencyMs: 120,
  medianLatencyMs: 80,
};

function renderCards() {
  return render(<SectionCards summary={summary} />);
}

describe("dashboard/SectionCards", () => {
  afterEach(() => {
    cleanup();
  });

  it("merges error count into the request card", () => {
    renderCards();

    expect(screen.getByText("请求数")).toBeInTheDocument();
    expect(screen.getByText("成功 8 · 错误 2")).toBeInTheDocument();
    expect(screen.getByText("成功率 80%")).toBeInTheDocument();
    expect(screen.queryByText("20%")).not.toBeInTheDocument();
  });

  it("shows cache activity in the footer and cache reads in the hit rate", () => {
    renderCards();

    expect(
      screen.getByText("输入 200K · 缓存 20K · 输出 10K"),
    ).toBeInTheDocument();
    expect(screen.getByText("缓存命中 7.5%")).toBeInTheDocument();
  });

  it("hides success rate when the range has no requests", () => {
    render(
      <SectionCards
        summary={{
          ...summary,
          totalRequests: 0,
          successRequests: 0,
          errorRequests: 0,
        }}
      />,
    );

    expect(screen.queryByText("成功率 0%")).not.toBeInTheDocument();
  });
});
