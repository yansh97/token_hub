import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  formatCompact,
  formatInteger,
  formatNanoUsdCost,
} from "@/features/dashboard/format";
import type { DashboardSummary } from "@/features/dashboard/types";
import { m } from "@/paraglide/messages.js";

type SectionCardsProps = {
  summary: DashboardSummary | null;
};

type MetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  badge?: ReactNode;
  detail?: ReactNode;
  className?: string;
};

function MetricCard({
  label,
  value,
  badge,
  detail,
  className,
}: MetricCardProps) {
  return (
    <article
      className={`flex min-h-[112px] min-w-0 flex-col gap-2 px-4 py-4 ${className ?? ""}`}
    >
      <div
        data-slot="card-description"
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </div>
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="truncate text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.02em]">
          {value}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {detail ? (
        <div className="truncate text-[13px] leading-5 text-foreground/80">
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
    ? m.dashboard_tokens_hint_with_cache({
        input: formatCompact(inputTokens),
        cached: formatCompact(cachedTokens),
        output: formatCompact(outputTokens),
      })
    : m.dashboard_tokens_hint_no_cache({
        input: formatCompact(inputTokens),
        output: formatCompact(outputTokens),
      });

  return (
    <section className="grid grid-cols-1 px-4 lg:px-6 @xl/main:grid-cols-[3fr_4fr_2.5fr_2.5fr]">
      <MetricCard
        label={m.dashboard_stat_requests()}
        value={formatCompact(totalRequests)}
        badge={
          totalRequests > 0 ? (
          <Badge
            variant="outline"
            className="h-7 rounded-md bg-muted/40 px-2 text-xs font-medium"
          >
            {m.dashboard_hint_success_rate({
              rate: PERCENT_FORMAT.format(successRate),
            })}
          </Badge>
          ) : null
        }
        detail={
          <div className="line-clamp-1">
            {m.dashboard_requests_footer({
              success: formatCompact(successRequests),
              errors: formatCompact(errorRequests),
            })}
          </div>
        }
      />

      <MetricCard
        label={m.dashboard_stat_total_tokens()}
        value={formatCompact(totalTokens)}
        badge={
          cacheReadTokens ? (
            <Badge
              variant="outline"
              className="h-7 rounded-md bg-muted/40 px-2 text-xs font-medium"
            >
              {m.dashboard_cache_hit_rate({
                rate: PERCENT_FORMAT.format(cacheHitRate),
              })}
            </Badge>
          ) : null
        }
        detail={<div className="line-clamp-1">{tokensHint}</div>}
      />

      <MetricCard
        label={m.dashboard_stat_latency_ms()}
        value={formatInteger(avgLatencyMs)}
        detail={
          <div className="line-clamp-1">
            {m.dashboard_latency_hint({
              median: formatInteger(medianLatencyMs),
            })}
          </div>
        }
      />

      <MetricCard
        label={m.dashboard_stat_cost()}
        value={formatNanoUsdCost(costNanoUsd)}
        detail="USD"
      />
    </section>
  );
}
