import { useCallback, useEffect, useRef, useState } from "react";
import { Power, PowerOff, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  capture,
}: DashboardFiltersProps) {
  return (
    <div
      data-slot="dashboard-filters"
      className={cn("sticky top-2.5 z-20 px-4 lg:px-6", className)}
    >
      <Card className="gap-0 rounded-lg border-border/70 bg-card/95 py-0 shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="flex min-w-0 flex-nowrap items-center gap-2">
            <Label className="whitespace-nowrap text-[13px] font-medium text-muted-foreground">
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
              className="overflow-hidden rounded-md border border-border/60 bg-transparent"
            >
              {DASHBOARD_RANGE_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className="border-r border-border/60 px-2.5 text-[13px] font-normal last:border-r-0 data-[state=on]:bg-muted data-[state=on]:font-semibold"
                >
                  {option.label()}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <Label
              htmlFor="dashboard-upstream"
              className="whitespace-nowrap text-[13px] font-medium text-muted-foreground"
            >
              {m.dashboard_upstream_label()}
            </Label>
            <Select
              value={resolveUpstreamSelectValue(upstreamId)}
              onValueChange={(value) => {
                onUpstreamChange(toUpstreamFilterValue(value));
              }}
            >
              <SelectTrigger
                id="dashboard-upstream"
                size="sm"
                className="w-28 text-[13px] font-normal"
                aria-label={m.dashboard_upstream_label()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-[13px]">
                <SelectItem
                  value={ALL_UPSTREAMS_VALUE}
                  className="text-[13px] font-normal"
                >
                  {m.dashboard_upstream_all()}
                </SelectItem>
                {upstreamOptions.map((option) => (
                  <SelectItem
                    key={option.upstreamId}
                    value={option.upstreamId}
                    className="text-[13px] font-normal"
                  >
                    {option.upstreamId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label
              htmlFor="dashboard-model"
              className="whitespace-nowrap text-[13px] font-medium text-muted-foreground"
            >
              {m.dashboard_model_label()}
            </Label>
            <Select
              value={resolveModelFilterValue(model)}
              onValueChange={(value) => {
                onModelChange(toModelFilterValue(value));
              }}
            >
              <SelectTrigger
                id="dashboard-model"
                size="sm"
                className="w-28 text-[13px] font-normal"
                aria-label={m.dashboard_model_label()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-[13px]">
                <SelectItem
                  value={ALL_MODELS_VALUE}
                  className="text-[13px] font-normal"
                >
                  {m.dashboard_model_all()}
                </SelectItem>
                {modelOptions.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                    className="text-[13px] font-normal"
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
