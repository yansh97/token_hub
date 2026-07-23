import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChartModelUsage } from "@/features/dashboard/components/chart-usage-ranking";

describe("dashboard/chart-usage-ranking", () => {
  afterEach(() => {
    cleanup();
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
