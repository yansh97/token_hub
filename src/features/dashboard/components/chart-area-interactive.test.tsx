import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChartAreaInteractive } from "@/features/dashboard/components/chart-area-interactive";

afterEach(() => {
  cleanup();
});

describe("dashboard/chart-area-interactive", () => {
  it("shows the empty state when the range has no series", () => {
    const { container } = render(
      <ChartAreaInteractive
        series={[]}
        range={{ fromTsMs: null, toTsMs: null }}
      />,
    );

    expect(screen.getByText("暂无数据")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="chart"]')).toBeNull();
    const chartArea = screen.getByText("暂无数据").parentElement;
    expect(chartArea).toHaveClass(
      "items-center",
      "justify-center",
      "rounded-md",
      "border",
      "border-dashed",
      "border-border",
    );
  });

  it("shows the empty state for zero-filled time buckets", () => {
    const { container } = render(
      <ChartAreaInteractive
        series={[
          {
            tsMs: 1,
            totalRequests: 0,
            errorRequests: 0,
            inputTokens: 0,
            outputTokens: 0,
            cachedTokens: 0,
            totalTokens: 0,
          },
        ]}
        range={{ fromTsMs: 0, toTsMs: 1 }}
      />,
    );

    expect(screen.getByText("暂无数据")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="chart"]')).toBeNull();
  });
});
