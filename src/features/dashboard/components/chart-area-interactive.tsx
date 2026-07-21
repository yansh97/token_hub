"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  createDashboardMinuteFormatter,
  formatDashboardTimestamp,
  formatInteger,
} from "@/features/dashboard/format";
import type {
  DashboardRange,
  DashboardSeriesPoint,
} from "@/features/dashboard/types";

type ChartPoint = {
  tsMs: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
};

const chartConfig = {
  inputTokens: {
    label: "输入",
    color: "var(--chart-1)",
  },
  outputTokens: {
    label: "输出",
    color: "var(--chart-2)",
  },
  cachedTokens: {
    label: "缓存读取",
    color: "var(--chart-3)",
  },
  totalTokens: {
    label: "总 Tokens",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

type ChartAreaInteractiveProps = {
  series: DashboardSeriesPoint[];
  range: DashboardRange;
};

type ChartBodyProps = {
  data: ChartPoint[];
  timeFormatter: Intl.DateTimeFormat;
  hasData?: boolean;
};

const FALLBACK_RANGE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveTimestampMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

function resolveTooltipTimestamp(payload: unknown) {
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }
  const first = payload[0];
  if (!isRecord(first)) {
    return null;
  }
  const inner = first.payload;
  if (!isRecord(inner)) {
    return null;
  }
  // Recharts tooltip label 可能缺失或被格式化，优先使用原始 payload 的时间戳。
  return resolveTimestampMs(inner.tsMs);
}

function formatTick(value: unknown, formatter: Intl.DateTimeFormat) {
  const tsMs = resolveTimestampMs(value);
  if (tsMs === null) {
    return "—";
  }
  return formatDashboardTimestamp(tsMs, formatter);
}

function resolveRangeBounds(range: DashboardRange) {
  const now = Date.now();
  // range=all 时用最近 7 天生成 0 线的时间范围
  const resolvedEnd = range.toTsMs ?? now;
  const resolvedStart =
    range.fromTsMs ?? resolvedEnd - FALLBACK_RANGE_DAYS * DAY_MS;
  const start = Math.min(resolvedStart, resolvedEnd);
  const end = Math.max(resolvedStart, resolvedEnd);
  if (end <= start) {
    return { start, end: start + 60 * 1000 };
  }
  return { start, end };
}

function buildZeroSeries(range: DashboardRange) {
  const { start, end } = resolveRangeBounds(range);
  return [
    {
      tsMs: start,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
    },
    {
      tsMs: end,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
    },
  ];
}

function ChartHeader() {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold leading-5">使用趋势</h2>
      <span className="text-[11px] text-muted-foreground">Tokens</span>
    </div>
  );
}

function ChartCanvas({ data, timeFormatter }: ChartBodyProps) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="tsMs"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => formatTick(value, timeFormatter)}
        />
        <ChartTooltip
          cursor={false}
          content={(props) => (
            <ChartTooltipContent
              {...props}
              labelFormatter={(value, payload) =>
                formatTick(
                  resolveTooltipTimestamp(payload) ?? value,
                  timeFormatter,
                )
              }
              formatter={(value, name) => {
                const label =
                  chartConfig[name as keyof typeof chartConfig]?.label ?? name;
                return (
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="ml-auto font-medium">
                      {formatInteger(Number(value))}
                    </span>
                  </div>
                );
              }}
              indicator="dot"
            />
          )}
        />
        <ChartLegend
          content={<ChartLegendContent className="gap-3 pt-2 text-[12px]" />}
        />
        <Line
          dataKey="inputTokens"
          type="monotone"
          stroke="var(--color-inputTokens)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          dataKey="outputTokens"
          type="monotone"
          stroke="var(--color-outputTokens)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          dataKey="cachedTokens"
          type="monotone"
          stroke="var(--color-cachedTokens)"
          strokeDasharray="5 5"
          strokeWidth={2}
          dot={false}
        />
        <Line
          dataKey="totalTokens"
          type="monotone"
          stroke="var(--color-totalTokens)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

function ChartBody({ data, timeFormatter, hasData }: ChartBodyProps) {
  return (
    <div
      className={`flex h-[232px] w-full items-center justify-center overflow-hidden rounded-md border p-2 ${
        hasData ? "border-border/70 bg-muted/10" : "border-dashed border-border"
      }`}
    >
      {hasData ? (
        <ChartCanvas data={data} timeFormatter={timeFormatter} />
      ) : (
        <p className="text-center text-[13px] text-muted-foreground">
          暂无数据
        </p>
      )}
    </div>
  );
}

export function ChartAreaInteractive({
  series,
  range,
}: ChartAreaInteractiveProps) {
  const timeFormatter = React.useMemo(
    () => createDashboardMinuteFormatter("zh-CN"),
    [],
  );
  const chartData = React.useMemo(() => {
    if (!series.length) {
      return buildZeroSeries(range);
    }
    return series.map((item) => ({
      tsMs: item.tsMs,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
      cachedTokens: item.cachedTokens,
      totalTokens: item.totalTokens,
    }));
  }, [range, series]);

  return (
    <section className="min-w-0">
      <ChartHeader />
      <ChartBody
        data={chartData}
        timeFormatter={timeFormatter}
        hasData={series.some((item) => item.totalRequests > 0)}
      />
    </section>
  );
}
