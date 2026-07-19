import type { DashboardRange } from "@/features/dashboard/types"
import { m } from "@/paraglide/messages.js"

export const DASHBOARD_RANGE_OPTIONS = [
  { value: "today", label: () => m.dashboard_range_today() },
  { value: "yesterday", label: () => m.dashboard_range_yesterday() },
  { value: "7d", label: () => m.dashboard_range_7d() },
  { value: "30d", label: () => m.dashboard_range_30d() },
  { value: "custom", label: () => m.dashboard_range_custom() },
  { value: "all", label: () => m.dashboard_range_all() },
] as const

export type DashboardTimeRange = (typeof DASHBOARD_RANGE_OPTIONS)[number]["value"]

const DASHBOARD_RANGE_VALUES: ReadonlySet<string> = new Set(
  DASHBOARD_RANGE_OPTIONS.map((option) => option.value)
)

const DAY_MS = 24 * 60 * 60 * 1000

export function toDashboardTimeRange(value: string) {
  return DASHBOARD_RANGE_VALUES.has(value)
    ? (value as DashboardTimeRange)
    : null
}

/** 本地日历日 00:00:00.000。 */
function startOfLocalDay(base: Date = new Date()) {
  const start = new Date(base)
  start.setHours(0, 0, 0, 0)
  return start
}

/** 本地日历日 23:59:59.999。 */
function endOfLocalDay(base: Date = new Date()) {
  const end = new Date(base)
  end.setHours(23, 59, 59, 999)
  return end
}

/** 进入「自定义」时的默认区间：今日 00:00 → 现在。 */
export function defaultCustomRange(nowMs: number = Date.now()): DashboardRange {
  return {
    fromTsMs: startOfLocalDay(new Date(nowMs)).getTime(),
    toTsMs: nowMs,
  }
}

/**
 * 规范化自定义区间：两端都有值且 from > to 时交换。
 * 允许一端为 null（表示开区间），后端 SQL 已支持。
 */
export function normalizeCustomRange(range: DashboardRange): DashboardRange {
  const { fromTsMs, toTsMs } = range
  if (fromTsMs != null && toTsMs != null && fromTsMs > toTsMs) {
    return { fromTsMs: toTsMs, toTsMs: fromTsMs }
  }
  return { fromTsMs, toTsMs }
}

export function resolveDashboardRange(
  range: DashboardTimeRange,
  customRange: DashboardRange | null = null
): DashboardRange {
  if (range === "all") {
    return { fromTsMs: null, toTsMs: null }
  }

  if (range === "custom") {
    const seed = customRange ?? defaultCustomRange()
    return normalizeCustomRange(seed)
  }

  const now = Date.now()

  if (range === "today") {
    return {
      fromTsMs: startOfLocalDay().getTime(),
      toTsMs: now,
    }
  }

  if (range === "yesterday") {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return {
      fromTsMs: startOfLocalDay(yesterday).getTime(),
      toTsMs: endOfLocalDay(yesterday).getTime(),
    }
  }

  const days = range === "7d" ? 7 : 30
  return { fromTsMs: now - days * DAY_MS, toTsMs: now }
}

/** `datetime-local` 输入值（本地时区，精确到分钟）。 */
export function tsMsToDatetimeLocalValue(tsMs: number) {
  const date = new Date(tsMs)
  const pad = (value: number) => String(value).padStart(2, "0")
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("")
}

/** 解析 `datetime-local`；非法值返回 null。 */
export function datetimeLocalValueToTsMs(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed.getTime()
}
