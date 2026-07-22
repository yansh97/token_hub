import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
  DashboardViewStateProvider,
  useDashboardViewState,
} from "@/features/dashboard/state";

function DashboardView() {
  const {
    rangePreset,
    setRangePreset,
    selectedUpstreamId,
    setSelectedUpstreamId,
    selectedModel,
    setSelectedModel,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
  } = useDashboardViewState();

  return (
    <div>
      <span>{`${rangePreset}:${selectedUpstreamId ?? "all"}:${selectedModel ?? "all"}:${autoRefreshEnabled}`}</span>
      <button type="button" onClick={() => setRangePreset("7d")}>
        set-range
      </button>
      <button type="button" onClick={() => setSelectedUpstreamId("alpha")}>
        set-upstream
      </button>
      <button type="button" onClick={() => setSelectedModel("gpt-5")}>
        set-model
      </button>
      <button type="button" onClick={() => setAutoRefreshEnabled(false)}>
        disable-auto-refresh
      </button>
    </div>
  );
}

function LogsView() {
  const { rangePreset, selectedUpstreamId, selectedModel, autoRefreshEnabled } =
    useDashboardViewState();

  return (
    <span>{`${rangePreset}:${selectedUpstreamId ?? "all"}:${selectedModel ?? "all"}:${autoRefreshEnabled}`}</span>
  );
}

function AppHarness() {
  const [page, setPage] = useState<"dashboard" | "logs">("dashboard");

  return (
    <DashboardViewStateProvider>
      <button type="button" onClick={() => setPage("logs")}>
        open-logs
      </button>
      {page === "dashboard" ? <DashboardView /> : <LogsView />}
    </DashboardViewStateProvider>
  );
}

describe("DashboardViewStateProvider", () => {
  it("retains shared filters and auto-refresh across page changes", () => {
    const view = render(<AppHarness />);

    expect(screen.getByText("today:all:all:true")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "set-range" }));
    fireEvent.click(screen.getByRole("button", { name: "set-upstream" }));
    fireEvent.click(screen.getByRole("button", { name: "set-model" }));
    fireEvent.click(
      screen.getByRole("button", { name: "disable-auto-refresh" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "open-logs" }));

    expect(screen.getByText("7d:alpha:gpt-5:false")).toBeInTheDocument();

    view.unmount();
    render(<AppHarness />);
    expect(screen.getByText("today:all:all:true")).toBeInTheDocument();
  });
});
