import { useCallback, useEffect, useRef, useState } from "react";
import { Power, PowerOff, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  readDashboardSnapshot,
  refreshDashboardModelDiscovery,
} from "@/features/dashboard/api";
import {
  DASHBOARD_RANGE_OPTIONS,
  type DashboardTimeRange,
  resolveDashboardRange,
} from "@/features/dashboard/range";
import type {
  DashboardRange,
  DashboardSnapshot,
  DashboardUpstreamOption,
} from "@/features/dashboard/types";
import { parseError } from "@/lib/error";

export const RECENT_PAGE_SIZE = 50;
const ALL_UPSTREAMS_VALUE = "__all_upstreams__";
const ALL_MODELS_VALUE = "__all_models__";

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

function hasModelOption(modelOptions: string[], model: string) {
  return modelOptions.includes(model);
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
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
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
        model: selectedModel,
      });
      if (requestSeq.current !== requestId) {
        return;
      }
      // 时间范围变化后，已选上游可能不再出现在该范围内；先回退到“全部”，
      // 让下一个 effect 重新拉取一个合法快照，避免筛选控件绑定到不存在的值。
      if (
        selectedUpstreamId !== null &&
        !hasUpstreamOption(data.upstreams, selectedUpstreamId)
      ) {
        setSelectedUpstreamId(null);
        setStatus("loading");
        return;
      }
      if (
        selectedModel !== null &&
        !hasModelOption(data.modelOptions, selectedModel)
      ) {
        setSelectedModel(null);
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
  }, [page, rangePreset, selectedModel, selectedUpstreamId]);

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
      setSelectedModel(null);
      resetPage();
    },
    [markLoading, resetPage],
  );

  const handleModelChange = useCallback(
    (nextModel: string | null) => {
      markLoading();
      setSelectedModel(nextModel);
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
    selectedModel,
    upstreamOptions: snapshot?.upstreams ?? [],
    modelOptions: snapshot?.modelOptions ?? [],
    pagination: { page, totalPages, totalRequests },
    refresh,
    onRangeChange: handleRangeChange,
    onUpstreamChange: handleUpstreamChange,
    onModelChange: handleModelChange,
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

function resolveModelFilterValue(model: string | null) {
  return model ?? ALL_MODELS_VALUE;
}

function toModelFilterValue(value: string) {
  return value === ALL_MODELS_VALUE ? null : value;
}

type DashboardFiltersProps = {
  range: DashboardTimeRange;
  upstreamId: string | null;
  upstreamOptions: DashboardUpstreamOption[];
  model: string | null;
  modelOptions: string[];
  loading: boolean;
  onRangeChange: (range: DashboardTimeRange) => void;
  onUpstreamChange: (upstreamId: string | null) => void;
  onModelChange: (model: string | null) => void;
  onRefresh: () => void;
  className?: string;
  sticky?: boolean;
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
  model,
  modelOptions,
  loading,
  onRangeChange,
  onUpstreamChange,
  onModelChange,
  onRefresh,
  className,
  sticky = false,
  capture,
}: DashboardFiltersProps) {
  return (
    <div
      data-slot="dashboard-filters"
      data-sticky={sticky ? "true" : "false"}
      className={cn(
        "shrink-0 border-b border-border/70 pb-4",
        sticky &&
          "sticky top-0 z-20 -mx-1 -mt-5 bg-background/95 px-1 pt-5 backdrop-blur lg:-mt-6 lg:pt-6",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {/* biome-ignore lint/a11y/useSemanticElements: This is a non-form ARIA button group. */}
          <div
            role="group"
            aria-label="时间范围"
            className="inline-flex h-8 overflow-hidden rounded-md border border-border bg-background"
          >
            {DASHBOARD_RANGE_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                aria-pressed={range === option.value}
                onClick={() => onRangeChange(option.value)}
                className="border-r border-border px-3 text-[12px] text-muted-foreground outline-none transition-colors last:border-r-0 hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/20 aria-pressed:bg-foreground aria-pressed:text-background"
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span>提供商</span>
            <select
              id="dashboard-upstream"
              value={resolveUpstreamSelectValue(upstreamId)}
              onChange={(event) =>
                onUpstreamChange(toUpstreamFilterValue(event.target.value))
              }
              className="h-8 min-w-28 rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
            >
              <option value={ALL_UPSTREAMS_VALUE}>全部</option>
              {upstreamOptions.map((option) => (
                <option key={option.upstreamId} value={option.upstreamId}>
                  {option.upstreamId}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span>模型</span>
            <select
              id="dashboard-model"
              value={resolveModelFilterValue(model)}
              onChange={(event) =>
                onModelChange(toModelFilterValue(event.target.value))
              }
              className="h-8 min-w-32 rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
            >
              <option value={ALL_MODELS_VALUE}>全部</option>
              {modelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          {capture ? (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2 rounded-full",
                  capture.enabled ? "bg-success" : "bg-muted-foreground/40",
                )}
                aria-hidden="true"
              />
              {capture.enabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="停止记录"
                  aria-label="停止记录"
                  className="text-destructive"
                  onClick={() => capture.onToggle(false)}
                  disabled={capture.loading}
                >
                  <PowerOff className="size-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="记录 10 分钟请求详情"
                  aria-label="记录 10 分钟请求详情"
                  className="text-success"
                  onClick={() => {
                    capture.onToggle(true);
                  }}
                  disabled={capture.loading}
                >
                  <Power className="size-3.5" />
                </Button>
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
            size="icon-sm"
            title="刷新"
            aria-label="刷新"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>
    </div>
  );
}
