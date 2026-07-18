import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ChartModelUsage } from "@/features/dashboard/components/chart-usage-ranking";
import { I18nProvider } from "@/lib/i18n";
import { m } from "@/paraglide/messages.js";

function renderWithI18n(node: ReactNode) {
  return render(<I18nProvider>{node}</I18nProvider>);
}

describe("dashboard/chart-usage-ranking", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows model empty state", () => {
    renderWithI18n(<ChartModelUsage models={[]} />);

    expect(screen.getByText(m.dashboard_models_title())).toBeTruthy();
    expect(screen.getByText(m.dashboard_no_data())).toBeTruthy();
  });

  it("renders model ranking chart when data exists", () => {
    const { container } = renderWithI18n(
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

    const card = container.querySelector('[data-slot="card"]');
    expect(card).toBeTruthy();
    expect(
      within(card as HTMLElement).getByText(m.dashboard_models_title()),
    ).toBeTruthy();
    expect(
      within(card as HTMLElement).queryByText(m.dashboard_no_data()),
    ).toBeNull();
    // recharts 挂载在 ChartContainer 上。
    expect(container.querySelector('[data-slot="chart"]')).toBeTruthy();
  });

  it("limits model usage to the top five models", () => {
    const { container } = renderWithI18n(
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
