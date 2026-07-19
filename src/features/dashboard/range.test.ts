import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveDashboardRange,
  toDashboardTimeRange,
} from "@/features/dashboard/range";

describe("dashboard/range", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses dashboard time range values", () => {
    expect(toDashboardTimeRange("7d")).toBe("7d");
    expect(toDashboardTimeRange("yesterday")).toBe("yesterday");
    expect(toDashboardTimeRange("unknown")).toBeNull();
  });

  it("resolves today range (from midnight to now)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-28T12:34:56.789Z"));

    const result = resolveDashboardRange("today");
    const expectedStart = new Date();
    expectedStart.setHours(0, 0, 0, 0);

    expect(result.fromTsMs).toBe(expectedStart.getTime());
    expect(result.toTsMs).toBe(Date.now());
  });

  it("resolves rolling window ranges", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-28T12:00:00.000Z"));

    const now = Date.now();
    expect(resolveDashboardRange("7d")).toEqual({
      fromTsMs: now - 7 * 24 * 60 * 60 * 1000,
      toTsMs: now,
    });
  });

  it("resolves yesterday as the full previous local day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 28, 15, 30));

    expect(resolveDashboardRange("yesterday")).toEqual({
      fromTsMs: new Date(2026, 0, 27, 0, 0, 0, 0).getTime(),
      toTsMs: new Date(2026, 0, 27, 23, 59, 59, 999).getTime(),
    });
  });
});
