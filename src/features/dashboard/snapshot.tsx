import { useCallback, useEffect, useRef, useState } from "react";
import { HelpCircle, Power, PowerOff, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  readDashboardSnapshot,
  refreshDashboardModelDiscovery,
} from "@/features/dashboard/api";
import {
  DASHBOARD_RANGE_OPTIONS,
  type DashboardTimeRange,
  resolveDashboardRange,
  toDashboardTimeRange,
} from "@/features/dashboard/range";
import type {
  DashboardRange,
  DashboardSnapshot,
  DashboardUpstreamOption,
} from "@/features/dashboard/types";
import { parseError } from "@/lib/error";
import { m } from "@/paraglide/messages.js";

export const RECENT_PAGE_SIZE = 50;
const ALL_UPSTREAMS_VALUE = "__all_upstreams__";

type DashboardStatus = "idle" | "loading" | "error";

type UseDashboardSnapshotOptions = {
  refreshModelDiscoveryOnRefresh?: boolean;
};

function hasUpstreamOption(
  upstreams: DashboardUpstreamOption[],
  upstreamId: string,
) {
  return upstreams.some((item) => item.upstreamId === upstreamId);
}

function usePagination(totalRequests: number) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(totalRequests / RECENT_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const resetPage = useCallback(() => {
    setPage(1);
  }, []);

  const onPrevPage = useCallback(() => {
    setPage((current) => Math.max(1, current - 1));
  }, []);

  const onNextPage = useCallback(() => {
    setPage((current) => current + 1);
  }, []);

  return {
    page: currentPage,
    totalPages,
    totalRequests,
    resetPage,
    onPrevPage,
    onNextPage,
  };
}

export function useDashboardSnapshot({
  refreshModelDiscoveryOnRefresh = false,
}: UseDashboardSnapshotOptions = {}) {
  const [rangePreset, setRangePreset] = useState<DashboardTimeRange>("today");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [selectedUpstreamId, setSelectedUpstreamId] = useState<string | null>(
    null,
  );
  const [activeRange, setActiveRange] = useState<DashboardRange>(() =>
    resolveDashboardRange("today"),
  );
  const [status, setStatus] = useState<DashboardStatus>("loading");
  const [statusMessage, setStatusMessage] = useState("");
  const totalRequests = snapshot?.summary.totalRequests ?? 0;
  const { page, totalPages, resetPage, onPrevPage, onNextPage } =
    usePagination(totalRequests);
  const requestSeq = useRef(0);

  const loadSnapshot = useCallback(async () => {
    // Ignore out-of-order responses; only the latest request updates state.
    const requestId = requestSeq.current + 1;
    requestSeq.current = requestId;
    try {
      const range = resolveDashboardRange(rangePreset);
      const offset = (page - 1) * RECENT_PAGE_SIZE;
      const data = await readDashboardSnapshot({
        range,
        offset,
        upstreamId: selectedUpstreamId,
        accountId: null,
        publicOnly: false,
      });
      if (requestSeq.current !== requestId) {
        return;
      }
      // 时间范围变化后，已选上游可能不再出现在该范围内；先回退到“全部”，
      // 让下一个 effect 重新拉取一个合法快照，避免 Select 绑定到不存在的值。
      if (
        selectedUpstreamId !== null &&
        !hasUpstreamOption(data.upstreams, selectedUpstreamId)
      ) {
        setSelectedUpstreamId(null);
        setStatus("loading");
        return;
      }
      setSnapshot(data);
      setActiveRange(range);
      setStatus("idle");
    } catch (error) {
      if (requestSeq.current !== requestId) {
        return;
      }
      setStatus("error");
      setStatusMessage(parseError(error));
    }
  }, [page, rangePreset, selectedUpstreamId]);

  useEffect(() => {
    // 提交后一拍再启动请求，避免 effect 同步路径被误判为级联 setState。
    const timerId = window.setTimeout(() => {
      void loadSnapshot();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [loadSnapshot]);

  const markLoading = useCallback(() => {
    setStatus("loading");
    setStatusMessage("");
  }, []);

  const handleRangeChange = useCallback(
    (next: DashboardTimeRange) => {
      markLoading();
      setRangePreset(next);
      resetPage();
    },
    [markLoading, resetPage],
  );

  const handleUpstreamChange = useCallback(
    (nextUpstreamId: string | null) => {
      markLoading();
      setSelectedUpstreamId(nextUpstreamId);
      resetPage();
    },
    [markLoading, resetPage],
  );

  const handlePrevPage = useCallback(() => {
    markLoading();
    onPrevPage();
  }, [markLoading, onPrevPage]);

  const handleNextPage = useCallback(() => {
    markLoading();
    onNextPage();
  }, [markLoading, onNextPage]);

  const refresh = useCallback(() => {
    markLoading();
    void (async () => {
      if (refreshModelDiscoveryOnRefresh) {
        try {
          await refreshDashboardModelDiscovery();
        } catch (error) {
          setStatus("error");
          setStatusMessage(parseError(error));
          return;
        }
      }
      await loadSnapshot();
    })();
  }, [loadSnapshot, markLoading, refreshModelDiscoveryOnRefresh]);

  return {
    snapshot,
    status,
    statusMessage,
    activeRange,
    rangePreset,
    selectedUpstreamId,
    upstreamOptions: snapshot?.upstreams ?? [],
    pagination: { page, totalPages, totalRequests },
    refresh,
    onRangeChange: handleRangeChange,
    onUpstreamChange: handleUpstreamChange,
    onPrevPage: handlePrevPage,
    onNextPage: handleNextPage,
  };
}

function resolveUpstreamSelectValue(upstreamId: string | null) {
  return upstreamId ?? ALL_UPSTREAMS_VALUE;
}

function toUpstreamFilterValue(value: string) {
  return value === ALL_UPSTREAMS_VALUE ? null : value;
}

type DashboardFiltersProps = {
  range: DashboardTimeRange;
  upstreamId: string | null;
  upstreamOptions: DashboardUpstreamOption[];
  loading: boolean;
  onRangeChange: (range: DashboardTimeRange) => void;
  onUpstreamChange: (upstreamId: string | null) => void;
  onRefresh: () => void;
  className?: string;
  /** 请求详情捕获相关，仅 LogsPanel 使用 */
  capture?: {
    enabled: boolean;
    loading: boolean;
    statusText?: string;
    onToggle: (enabled: boolean) => void;
  };
};

export function DashboardFilters({
  range,
  upstreamId,
  upstreamOptions,
  loading,
  onRangeChange,
  onUpstreamChange,
  onRefresh,
  className,
  capture,
}: DashboardFiltersProps) {
  return (
    <div
      data-slot="dashboard-filters"
      className={cn("sticky top-2.5 z-20 px-4 lg:px-6", className)}
    >
      <Card className="gap-0 rounded-lg border-border/70 bg-card/95 py-0 shadow-none">
        <CardContent className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
          <div className="flex flex-col items-start gap-0.5">
            <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-0.5">
              <Label className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                {m.dashboard_range_label()}
              </Label>
              <ToggleGroup
                type="single"
                value={range}
                onValueChange={(value) => {
                  const next = toDashboardTimeRange(value);
                  if (next) {
                    onRangeChange(next);
                  }
                }}
                variant="default"
                size="sm"
                spacing={0}
                aria-label={m.dashboard_range_label()}
                className="rounded-md bg-transparent"
              >
                {DASHBOARD_RANGE_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className="px-2.5 text-[13px] font-normal data-[state=on]:bg-muted data-[state=on]:font-semibold"
                  >
                    {option.label()}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-0.5">
              <Label className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                {m.dashboard_upstream_label()}
              </Label>
              <ToggleGroup
                type="single"
                value={resolveUpstreamSelectValue(upstreamId)}
                onValueChange={(value) => {
                  if (value) {
                    onUpstreamChange(toUpstreamFilterValue(value));
                  }
                }}
                variant="default"
                size="sm"
                spacing={0}
                aria-label={m.dashboard_upstream_label()}
                className="min-w-0 max-w-full flex-wrap rounded-md bg-transparent"
              >
                <ToggleGroupItem
                  value={ALL_UPSTREAMS_VALUE}
                  className="px-2.5 text-[13px] font-normal data-[state=on]:bg-muted data-[state=on]:font-semibold"
                >
                  {m.dashboard_upstream_all()}
                </ToggleGroupItem>
                {upstreamOptions.map((option) => (
                  <ToggleGroupItem
                    key={option.upstreamId}
                    value={option.upstreamId}
                    className="px-2.5 text-[13px] font-normal data-[state=on]:bg-muted data-[state=on]:font-semibold"
                  >
                    {option.upstreamId}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {capture ? (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    capture.enabled ? "bg-green-500" : "bg-muted-foreground/40",
                  )}
                  aria-hidden="true"
                />
                <Label
                  htmlFor="logs-capture"
                  className="text-xs text-muted-foreground"
                >
                  {m.logs_capture_title()}
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    {capture.enabled
                      ? m.logs_capture_desc()
                      : m.logs_capture_idle_desc()}
                  </TooltipContent>
                </Tooltip>
                {capture.enabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive"
                        onClick={() => capture.onToggle(false)}
                        disabled={capture.loading}
                      >
                        <PowerOff className="size-3.5" />
                        <span className="sr-only">{m.logs_capture_stop()}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {m.logs_capture_stop()}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-green-600"
                        onClick={() => {
                          capture.onToggle(true);
                        }}
                        disabled={capture.loading}
                      >
                        <Power className="size-3.5" />
                        <span className="sr-only">
                          {m.logs_capture_start()}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {m.logs_capture_start()}
                    </TooltipContent>
                  </Tooltip>
                )}
                {capture.enabled && capture.statusText ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {capture.statusText}
                  </span>
                ) : null}
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
              <span className="sr-only">{m.common_refresh()}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
