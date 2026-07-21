import { Badge } from "@/components/ui/badge";
import {
  createDashboardTimeFormatter,
  formatCompact,
  formatDashboardClockTime,
  formatDashboardProviderLabel,
  formatDashboardTimestamp,
  formatInteger,
  formatNanoUsdCost,
} from "@/features/dashboard/format";
import type { DashboardRequestItem } from "@/features/dashboard/types";

const EMPTY_VALUE = "—";
const TIME_FORMATTER = createDashboardTimeFormatter("zh-CN");

function statusVariant(status: number) {
  if (status >= 200 && status < 300) return "default" as const;
  if (status >= 400) return "destructive" as const;
  if (status >= 300) return "secondary" as const;
  return "outline" as const;
}

function tokenDetail(item: DashboardRequestItem) {
  const parts = [
    item.outputTokens == null ? null : `输出 ${formatCompact(item.outputTokens)}`,
    item.cachedTokens ? `缓存 ${formatCompact(item.cachedTokens)}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function timingTitle(item: DashboardRequestItem) {
  return [
    `总耗时: ${formatInteger(item.latencyMs)} ms`,
    `响应头: ${item.upstreamResponseHeadersMs == null ? EMPTY_VALUE : `${formatInteger(item.upstreamResponseHeadersMs)} ms`}`,
    `上游首块: ${item.upstreamFirstBodyChunkMs == null && item.upstreamFirstByteMs == null ? EMPTY_VALUE : `${formatInteger(item.upstreamFirstBodyChunkMs ?? item.upstreamFirstByteMs ?? 0)} ms`}`,
    `客户端首包: ${item.firstClientFlushMs == null ? EMPTY_VALUE : `${formatInteger(item.firstClientFlushMs)} ms`}`,
    `首次输出: ${item.firstOutputMs == null ? EMPTY_VALUE : `${formatInteger(item.firstOutputMs)} ms`}`,
  ].join("\n");
}

type RecentRequestsTableProps = {
  items: DashboardRequestItem[];
  onSelectItem?: (item: DashboardRequestItem) => void;
};

export function RecentRequestsTable({
  items,
  onSelectItem,
}: RecentRequestsTableProps) {
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border/70">
      <table className="w-full table-fixed border-collapse text-[13px]">
        <colgroup>
          <col className="w-[9%]" />
          <col className="w-[16%]" />
          <col className="w-[13%]" />
          <col className="w-[18%]" />
          <col className="w-[8%]" />
          <col className="w-[18%]" />
          <col className="w-[8%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="text-left text-[11px] font-medium text-muted-foreground">
            <th className="bg-background px-2 py-2 shadow-[inset_0_-1px_0_var(--border)]">时间</th>
            <th className="bg-background px-2 py-2 shadow-[inset_0_-1px_0_var(--border)]">路径</th>
            <th className="bg-background px-2 py-2 shadow-[inset_0_-1px_0_var(--border)]">提供商</th>
            <th className="bg-background px-2 py-2 shadow-[inset_0_-1px_0_var(--border)]">模型</th>
            <th className="bg-background px-2 py-2 shadow-[inset_0_-1px_0_var(--border)]">状态</th>
            <th className="bg-background px-2 py-2 shadow-[inset_0_-1px_0_var(--border)]">Tokens</th>
            <th className="bg-background px-2 py-2 shadow-[inset_0_-1px_0_var(--border)]">费用</th>
            <th className="bg-background px-2 py-2 shadow-[inset_0_-1px_0_var(--border)]">响应头</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const provider = formatDashboardProviderLabel(
              item.upstreamId,
              item.provider,
              item.accountId,
            );
            const tokens =
              item.totalTokens == null
                ? EMPTY_VALUE
                : formatCompact(item.totalTokens);
            const responseHeaders =
              item.upstreamResponseHeadersMs == null
                ? EMPTY_VALUE
                : formatInteger(item.upstreamResponseHeadersMs);
            return (
              <tr
                key={item.id}
                role={onSelectItem ? "button" : undefined}
                tabIndex={onSelectItem ? 0 : undefined}
                onClick={() => onSelectItem?.(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectItem?.(item);
                  }
                }}
                className="border-b border-border/60 bg-background transition-colors last:border-b-0 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/20"
              >
                <td
                  className="truncate px-2 py-2 text-[12px] tabular-nums text-muted-foreground"
                  title={formatDashboardTimestamp(item.tsMs, TIME_FORMATTER)}
                >
                  {formatDashboardClockTime(item.tsMs)}
                </td>
                <td className="truncate px-2 py-2 font-medium" title={item.path}>
                  {item.path}
                </td>
                <td className="truncate px-2 py-2 text-muted-foreground" title={provider}>
                  {item.upstreamId}
                </td>
                <td className="px-2 py-2" title={[item.model, item.mappedModel].filter(Boolean).join("\n")}>
                  <div className="truncate font-medium">{item.model || EMPTY_VALUE}</div>
                  {item.mappedModel ? (
                    <div className="truncate text-[11px] text-muted-foreground">
                      {item.mappedModel}
                    </div>
                  ) : null}
                </td>
                <td className="px-2 py-2">
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                </td>
                <td className="px-2 py-2" title={tokenDetail(item)}>
                  <div className="font-medium tabular-nums">{tokens}</div>
                  {tokenDetail(item) ? (
                    <div className="truncate text-[11px] text-muted-foreground">
                      {tokenDetail(item)}
                    </div>
                  ) : null}
                </td>
                <td
                  className="truncate px-2 py-2 tabular-nums text-muted-foreground"
                  title={`计费模型: ${item.pricingModel || EMPTY_VALUE}\n计费档位: ${item.pricingContextTier || EMPTY_VALUE}\n计费版本: ${item.pricingVersion || EMPTY_VALUE}`}
                >
                  {formatNanoUsdCost(item.costNanoUsd)}
                </td>
                <td
                  className="truncate px-2 py-2 tabular-nums text-muted-foreground"
                  title={timingTitle(item)}
                >
                  {responseHeaders}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
