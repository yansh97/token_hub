import type { DashboardRange } from "@/features/dashboard/types";
import { m } from "@/paraglide/messages.js";

export const DASHBOARD_RANGE_OPTIONS = [
  { value: "today", label: () => m.dashboard_range_today() },
  { value: "yesterday", label: () => m.dashboard_range_yesterday() },
  { value: "7d", label: () => m.dashboard_range_7d() },
  { value: "30d", label: () => m.dashboard_range_30d() },
  { value: "all", label: () => m.dashboard_range_all() },
] as const;

export type DashboardTimeRange =
  (typeof DASHBOARD_RANGE_OPTIONS)[number]["value"];

const DASHBOARD_RANGE_VALUES: ReadonlySet<string> = new Set(
  DASHBOARD_RANGE_OPTIONS.map((option) => option.value),
);

export function toDashboardTimeRange(value: string) {
  return DASHBOARD_RANGE_VALUES.has(value)
    ? (value as DashboardTimeRange)
    : null;
}

export function resolveDashboardRange(
  range: DashboardTimeRange,
): DashboardRange {
  if (range === "all") {
    return { fromTsMs: null, toTsMs: null };
  }

  const now = Date.now();

  if (range === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { fromTsMs: start.getTime(), toTsMs: now };
  }

  if (range === "yesterday") {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { fromTsMs: start.getTime(), toTsMs: end.getTime() };
  }

  const days = range === "7d" ? 7 : 30;
  return { fromTsMs: now - days * 24 * 60 * 60 * 1000, toTsMs: now };
}
