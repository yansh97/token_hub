import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChartModelUsage } from "@/features/dashboard/components/chart-usage-ranking";

describe("dashboard/chart-usage-ranking", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows model empty state", () => {
    render(<ChartModelUsage models={[]} />);

    expect(screen.getByText("模型用量")).toBeTruthy();
    const emptyState = screen.getByText("暂无数据");
    expect(emptyState).toBeTruthy();
    expect(emptyState.parentElement).toHaveClass(
      "items-center",
      "justify-center",
      "rounded-md",
      "border",
      "border-dashed",
      "border-border",
    );
  });

  it("renders model ranking chart when data exists", () => {
    const { container } = render(
      <ChartModelUsage
        models={[
          {
            model: "gpt-5.4",
            requests: 2,
            totalTokens: 400,
            inputTokens: 300,
            outputTokens: 100,
            costNanoUsd: 3000,
            cachedTokens: 0,
          },
        ]}
      />,
    );

    const section = container.querySelector("section");
    expect(section).toBeTruthy();
    const chart = container.querySelector('[data-slot="chart"]');
    expect(chart).toBeTruthy();
    expect(chart?.parentElement).toHaveClass(
      "rounded-md",
      "border",
      "border-border/70",
      "bg-muted/10",
    );
    expect(chart?.parentElement).not.toHaveClass("border-dashed");
    expect(chart?.parentElement).toHaveStyle({ height: "232px" });
    expect(
      within(section as HTMLElement).getByText("模型用量"),
    ).toBeTruthy();
    expect(
      within(section as HTMLElement).queryByText("暂无数据"),
    ).toBeNull();
    // recharts 挂载在 ChartContainer 上。
  });

  it("limits model usage to the top five models", () => {
    const { container } = render(
      <ChartModelUsage
        models={Array.from({ length: 6 }, (_, index) => ({
          model: `model-${index + 1}`,
          requests: 1,
          totalTokens: 600 - index,
          inputTokens: 0,
          outputTokens: 0,
          costNanoUsd: 0,
          cachedTokens: 0,
        }))}
      />,
    );

    expect(container.querySelector('[data-model-count="5"]')).toBeTruthy();
  });
});
