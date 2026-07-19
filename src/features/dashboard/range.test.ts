import { afterEach, describe, expect, it, vi } from "vitest";

import {
  datetimeLocalValueToTsMs,
  defaultCustomRange,
  normalizeCustomRange,
  resolveDashboardRange,
  toDashboardTimeRange,
  tsMsToDatetimeLocalValue,
} from "@/features/dashboard/range";

describe("dashboard/range", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses dashboard time range values", () => {
    expect(toDashboardTimeRange("7d")).toBe("7d");
    expect(toDashboardTimeRange("yesterday")).toBe("yesterday");
    expect(toDashboardTimeRange("custom")).toBe("custom");
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

  it("resolves yesterday as full local calendar day", () => {
    vi.useFakeTimers();
    // 固定到本地中午，避免跨日边界抖动。
    vi.setSystemTime(new Date(2026, 0, 28, 15, 30, 0, 0));

    const result = resolveDashboardRange("yesterday");
    const start = new Date(2026, 0, 27, 0, 0, 0, 0);
    const end = new Date(2026, 0, 27, 23, 59, 59, 999);

    expect(result).toEqual({
      fromTsMs: start.getTime(),
      toTsMs: end.getTime(),
    });
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

  it("resolves custom range and swaps inverted bounds", () => {
    const custom = resolveDashboardRange("custom", {
      fromTsMs: 2000,
      toTsMs: 1000,
    });
    expect(custom).toEqual({ fromTsMs: 1000, toTsMs: 2000 });

    expect(
      normalizeCustomRange({ fromTsMs: 5, toTsMs: 1 })
    ).toEqual({ fromTsMs: 1, toTsMs: 5 });
  });

  it("defaults custom range to today start through now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 28, 18, 0, 0, 0));

    const result = defaultCustomRange();
    const start = new Date(2026, 0, 28, 0, 0, 0, 0);
    expect(result.fromTsMs).toBe(start.getTime());
    expect(result.toTsMs).toBe(Date.now());
  });

  it("round-trips datetime-local values in local timezone", () => {
    const ts = new Date(2026, 0, 28, 9, 5, 0, 0).getTime();
    const local = tsMsToDatetimeLocalValue(ts);
    expect(local).toBe("2026-01-28T09:05");
    expect(datetimeLocalValueToTsMs(local)).toBe(ts);
    expect(datetimeLocalValueToTsMs("")).toBeNull();
    expect(datetimeLocalValueToTsMs("not-a-date")).toBeNull();
  });
});
