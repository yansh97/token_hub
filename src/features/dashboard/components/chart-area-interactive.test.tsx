import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChartAreaInteractive } from "@/features/dashboard/components/chart-area-interactive";
import { I18nProvider } from "@/lib/i18n";
import { m } from "@/paraglide/messages.js";

afterEach(() => {
  cleanup();
});

describe("dashboard/chart-area-interactive", () => {
  it("shows the empty state when the range has no series", () => {
    const { container } = render(
      <I18nProvider>
        <ChartAreaInteractive
          series={[]}
          range={{ fromTsMs: null, toTsMs: null }}
        />
      </I18nProvider>,
    );

    expect(screen.getByText(m.dashboard_no_data())).toBeInTheDocument();
    expect(container.querySelector('[data-slot="chart"]')).toBeNull();
    const chartArea = screen.getByText(m.dashboard_no_data()).parentElement;
    expect(chartArea).toHaveClass(
      "items-center",
      "justify-center",
      "rounded-md",
      "border",
      "border-border/60",
    );
  });

  it("shows the empty state for zero-filled time buckets", () => {
    const { container } = render(
      <I18nProvider>
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
        />
      </I18nProvider>,
    );

    expect(screen.getByText(m.dashboard_no_data())).toBeInTheDocument();
    expect(container.querySelector('[data-slot="chart"]')).toBeNull();
  });
});
