"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  formatCompact,
  formatInteger,
  formatNanoUsdCost,
} from "@/features/dashboard/format";
import type { DashboardModelStat } from "@/features/dashboard/types";

/** 横向排行图通用行；key 稳定，label 展示。 */
type RankingRow = {
  key: string;
  label: string;
  totalTokens: number;
  requests: number;
  costNanoUsd: number;
};

const chartConfig = {
  totalTokens: {
    label: "总 Tokens",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const BAR_ROW_PX = 30;
const CHART_MIN_HEIGHT_PX = 232;
const Y_AXIS_WIDTH = 112;
const MODEL_USAGE_DISPLAY_LIMIT = 5;

type ChartUsageRankingProps = {
  title: string;
  rows: RankingRow[];
};

function truncateLabel(label: string, max = 18) {
  const trimmed = label.trim() || "—";
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1)}…`;
}

function resolveChartHeight(rowCount: number) {
  if (rowCount <= 0) {
    return CHART_MIN_HEIGHT_PX;
  }
  return Math.max(CHART_MIN_HEIGHT_PX, rowCount * BAR_ROW_PX + 24);
}

function RankingTooltip({
  label,
  requests,
  totalTokens,
  costNanoUsd,
}: {
  label: string;
  requests: number;
  totalTokens: number;
  costNanoUsd: number;
}) {
  return (
    <div className="grid min-w-[10rem] gap-1.5">
      <div className="font-medium break-all">{label}</div>
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="text-muted-foreground">总 Tokens</span>
        <span className="font-medium tabular-nums">
          {formatInteger(totalTokens)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="text-muted-foreground">请求数</span>
        <span className="font-medium tabular-nums">
          {formatInteger(requests)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="text-muted-foreground">费用</span>
        <span className="font-medium tabular-nums">
          {formatNanoUsdCost(costNanoUsd)}
        </span>
      </div>
    </div>
  );
}

function ChartUsageRanking({ title, rows }: ChartUsageRankingProps) {
  const chartData = React.useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        // Y 轴短标签；tooltip 用完整 label。
        tickLabel: truncateLabel(row.label),
      })),
    [rows],
  );
  const height = resolveChartHeight(chartData.length);

  return (
    <section className="min-w-0" data-model-count={chartData.length}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold leading-5">{title}</h2>
        <span className="text-[11px] text-muted-foreground">Top 5</span>
      </div>
      <div
        className={`flex w-full items-center justify-center overflow-hidden rounded-md border ${
          chartData.length
            ? "border-border/70 bg-muted/10"
            : "border-dashed border-border"
        }`}
        style={{ height }}
      >
        {chartData.length === 0 ? (
          <p className="text-center text-[13px] text-muted-foreground">
            暂无数据
          </p>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-full w-full"
          >
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                dataKey="totalTokens"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => formatCompact(Number(value))}
              />
              <YAxis
                type="category"
                dataKey="tickLabel"
                width={Y_AXIS_WIDTH}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }
                  const row = payload[0]?.payload as RankingRow | undefined;
                  if (!row) {
                    return null;
                  }
                  // 自定义 tooltip，避免 ChartTooltipContent 单值 formatter 套娃。
                  return (
                    <div className="border-border/50 bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
                      <RankingTooltip
                        label={row.label}
                        requests={row.requests}
                        totalTokens={row.totalTokens}
                        costNanoUsd={row.costNanoUsd}
                      />
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="totalTokens"
                fill="var(--color-totalTokens)"
                radius={4}
                maxBarSize={28}
              />
            </BarChart>
          </ChartContainer>
        )}
      </div>
    </section>
  );
}

type ChartModelUsageProps = {
  models: DashboardModelStat[];
};

export function ChartModelUsage({ models }: ChartModelUsageProps) {
  const rows = React.useMemo(
    () =>
      models.slice(0, MODEL_USAGE_DISPLAY_LIMIT).map((item) => ({
        key: item.model,
        label: item.model,
        totalTokens: item.totalTokens,
        requests: item.requests,
        costNanoUsd: item.costNanoUsd,
      })),
    [models],
  );

  return <ChartUsageRanking title="模型用量" rows={rows} />;
}
