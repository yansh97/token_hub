import type { ReactNode } from "react";

import {
  formatCompact,
  formatInteger,
  formatNanoUsdCost,
} from "@/features/dashboard/format";
import type { DashboardSummary } from "@/features/dashboard/types";

type SectionCardsProps = {
  summary: DashboardSummary | null;
};

type MetricItemProps = {
  label: ReactNode;
  value: ReactNode;
  badge?: ReactNode;
  detail?: ReactNode;
  className?: string;
};

function MetricItem({
  label,
  value,
  badge,
  detail,
  className,
}: MetricItemProps) {
  return (
    <article
      className={`min-w-0 border-l border-border/70 px-5 first:border-l-0 first:pl-0 last:pr-0 ${className ?? ""}`}
    >
      <div
        data-slot="metric-label"
        className="text-[12px] font-medium text-muted-foreground"
      >
        {label}
      </div>
      <div className="mt-2 flex min-w-0 items-baseline gap-2.5">
        <div
          data-slot="metric-value"
          className="whitespace-nowrap text-[28px] font-semibold leading-8 tabular-nums"
        >
          {value}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {detail ? (
        <div className="mt-1 truncate text-[12px] leading-5 text-muted-foreground">
          {detail}
        </div>
      ) : null}
    </article>
  );
}

const PERCENT_FORMAT = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});

export function SectionCards({ summary }: SectionCardsProps) {
  const totalRequests = summary?.totalRequests ?? 0;
  const successRequests = summary?.successRequests ?? 0;
  const errorRequests = summary?.errorRequests ?? 0;
  const costNanoUsd = summary?.costNanoUsd ?? 0;
  const totalTokens = summary?.totalTokens ?? 0;
  const inputTokens = summary?.inputTokens ?? 0;
  const outputTokens = summary?.outputTokens ?? 0;
  const cachedTokens = summary?.cachedTokens ?? 0;
  const cacheReadTokens = summary?.cacheReadTokens ?? 0;
  const avgLatencyMs = summary?.avgLatencyMs ?? 0;
  const medianLatencyMs = summary?.medianLatencyMs ?? 0;
  const successRate = totalRequests > 0 ? successRequests / totalRequests : 0;
  // Cache writes are cache activity, not cache hits.
  const cacheHitRate = inputTokens > 0 ? cacheReadTokens / inputTokens : 0;

  const tokensHint = cachedTokens
    ? `输入 ${formatCompact(inputTokens)} · 缓存 ${formatCompact(cachedTokens)} · 输出 ${formatCompact(outputTokens)}`
    : `输入 ${formatCompact(inputTokens)} · 输出 ${formatCompact(outputTokens)}`;

  return (
    <section className="dashboard-metrics-grid grid border-b border-border/70 pb-6">
      <MetricItem
        label="请求数"
        value={formatCompact(totalRequests)}
        badge={
          totalRequests > 0 ? (
            <span className="text-[11px] font-medium text-success">
              成功率 {PERCENT_FORMAT.format(successRate)}
            </span>
          ) : null
        }
        detail={
          <div className="line-clamp-1">
            成功 {formatCompact(successRequests)} · 错误{" "}
            {formatCompact(errorRequests)}
          </div>
        }
      />

      <MetricItem
        label="总 Tokens"
        value={formatCompact(totalTokens)}
        badge={
          cacheReadTokens ? (
            <span className="text-[11px] font-medium text-muted-foreground">
              缓存命中 {PERCENT_FORMAT.format(cacheHitRate)}
            </span>
          ) : null
        }
        detail={<div className="line-clamp-1">{tokensHint}</div>}
      />

      <MetricItem
        label="平均响应"
        value={formatInteger(avgLatencyMs)}
        detail={
          <div className="line-clamp-1">
            中位数 {formatInteger(medianLatencyMs)} ms
          </div>
        }
      />

      <MetricItem
        label="费用"
        value={formatNanoUsdCost(costNanoUsd)}
        detail="USD"
      />
    </section>
  );
}
