import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { AlertCircle } from "lucide-react";

import { DataTable } from "@/features/dashboard/components/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DashboardFilters,
  useDashboardSnapshot,
} from "@/features/dashboard/snapshot";
import {
  createDashboardTimeFormatter,
  formatDashboardClientIp,
  formatDashboardProviderLabel,
  formatDashboardTimestamp,
  formatInteger,
  formatNanoUsdCost,
} from "@/features/dashboard/format";
import {
  readRequestDetailCapture,
  readRequestLogDetail,
  setRequestDetailCapture,
} from "@/features/logs/api";
import type {
  RequestDetailCaptureState,
  RequestLogDetail,
} from "@/features/logs/types";
import { parseError } from "@/lib/error";
import { cn } from "@/lib/utils";

const DETAIL_PLACEHOLDER = "—";
const REQUEST_DETAIL_CAPTURE_EVENT = "request-detail-capture-changed";
const CAPTURE_COUNTDOWN_TICK_MS = 1_000;
const DETAIL_FIELD_ROW_CLASS =
  "grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-x-3 py-1";
const DETAIL_FIELD_LABEL_CLASS =
  "text-[12px] leading-5 text-muted-foreground";
const DETAIL_FIELD_VALUE_CLASS =
  "min-w-0 justify-self-start text-[13px] leading-5 text-foreground";
const IDLE_CAPTURE_STATE: RequestDetailCaptureState = {
  enabled: false,
  expiresAtMs: null,
};
const PROVIDER_TYPE_LABELS: Readonly<Record<string, string>> = {
  openai: "OpenAI",
  "openai-response": "OpenAI Responses",
  anthropic: "Anthropic",
  gemini: "Gemini",
  kiro: "Kiro",
  codex: "Codex",
  proxy: "内部代理",
};

type DetailStatus = "idle" | "loading" | "error";

type RequestDetailCaptureEvent = RequestDetailCaptureState;

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function statusToVariant(status: number): BadgeVariant {
  if (status >= 200 && status < 300) return "default";
  if (status >= 400) return "destructive";
  if (status >= 300) return "secondary";
  return "outline";
}

function formatHttpStatus(status: number) {
  let label = "";
  if (status >= 100 && status < 200) label = "信息";
  if (status >= 200 && status < 300) label = "成功";
  if (status >= 300 && status < 400) label = "重定向";
  if (status >= 400 && status < 500) label = "客户端错误";
  if (status >= 500 && status < 600) label = "服务端错误";
  return label ? `${status} ${label}` : String(status);
}

function formatProviderType(provider: string) {
  const trimmed = provider.trim();
  return PROVIDER_TYPE_LABELS[trimmed.toLowerCase()] ?? trimmed;
}

function formatUsdCost(value: number | null | undefined) {
  const amount = formatNanoUsdCost(value);
  return amount === DETAIL_PLACEHOLDER ? amount : `$${amount}`;
}

function isCaptureWindowActive(
  state: RequestDetailCaptureState,
  nowMs: number,
) {
  if (!state.enabled) {
    return false;
  }
  if (state.expiresAtMs === null) {
    return true;
  }
  return state.expiresAtMs > nowMs;
}

function getCaptureRemainingSeconds(
  state: RequestDetailCaptureState,
  nowMs: number,
) {
  if (!state.enabled || state.expiresAtMs === null) {
    return null;
  }
  const remainingMs = state.expiresAtMs - nowMs;
  if (remainingMs <= 0) {
    return null;
  }
  return Math.max(1, Math.ceil(remainingMs / CAPTURE_COUNTDOWN_TICK_MS));
}

function getResponseDetailValue(detail: RequestLogDetail) {
  // 空白响应体没有排障价值，优先回退到错误摘要。
  return detail.responseBody?.trim()
    ? detail.responseBody
    : detail.responseError;
}

type DetailFieldProps = {
  label: string;
  value: string | null | undefined;
  className?: string;
};

function DetailField({ label, value, className }: DetailFieldProps) {
  return (
    <div className={cn(DETAIL_FIELD_ROW_CLASS, className)}>
      <span className={DETAIL_FIELD_LABEL_CLASS}>{label}</span>
      <span className={`${DETAIL_FIELD_VALUE_CLASS} truncate`}>
        {value?.trim() || DETAIL_PLACEHOLDER}
      </span>
    </div>
  );
}

function DetailGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5 border-t border-border/60 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[13px] font-semibold leading-5 text-foreground">
        {title}
      </h3>
      <div className="grid gap-x-6 lg:grid-cols-2">{children}</div>
    </section>
  );
}

type BasicInfoSectionProps = {
  detail: RequestLogDetail;
  formatter: Intl.DateTimeFormat;
};

function BasicInfoSection({ detail, formatter }: BasicInfoSectionProps) {
  const timestamp = formatDashboardTimestamp(detail.tsMs, formatter);
  const streamText = detail.stream
    ? "流式"
    : "非流式";
  const combinedProviderText = formatDashboardProviderLabel(
    detail.upstreamId,
    detail.provider,
    detail.accountId,
  );
  const providerText =
    combinedProviderText === "本地代理"
      ? combinedProviderText
      : detail.upstreamId.trim();
  // 只有当 mappedModel 与 model 不同时才展示（相同说明没有实际映射）
  const hasMappedModel =
    detail.mappedModel?.trim() &&
    detail.model?.trim() &&
    detail.mappedModel.trim() !== detail.model.trim();

  return (
    <div data-slot="request-detail-groups" className="space-y-4">
      <DetailGroup title="请求">
        <DetailField label="请求 ID" value={`#${detail.id}`} />
        <DetailField label={"时间"} value={timestamp} />
        <DetailField label={"路径"} value={detail.path} />
        <DetailField
          label={"客户端"}
          value={formatDashboardClientIp(detail.clientIp)}
        />
        <div className={DETAIL_FIELD_ROW_CLASS}>
          <span className={DETAIL_FIELD_LABEL_CLASS}>{"状态"}</span>
          <Badge
            variant={statusToVariant(detail.status)}
            className="justify-self-start"
          >
            {formatHttpStatus(detail.status)}
          </Badge>
        </div>
        <DetailField label={"响应模式"} value={streamText} />
      </DetailGroup>

      <DetailGroup title="路由与计费">
        <DetailField label={"提供商"} value={providerText} />
        <DetailField
          label={"接口格式"}
          value={formatProviderType(detail.provider)}
        />
        <div className={DETAIL_FIELD_ROW_CLASS}>
          <span className={DETAIL_FIELD_LABEL_CLASS}>{"模型"}</span>
          <div className="flex min-w-0 flex-col items-start">
            <span className="w-full truncate text-[13px] text-foreground">
              {detail.model?.trim() || DETAIL_PLACEHOLDER}
            </span>
            {hasMappedModel ? (
              <span className="w-full truncate text-[12px] text-muted-foreground">
                {detail.mappedModel}
              </span>
            ) : null}
          </div>
        </div>
        <DetailField
          label={"费用"}
          value={formatUsdCost(detail.costNanoUsd)}
        />
        <DetailField
          label={"计费模型"}
          value={detail.pricingModel}
        />
      </DetailGroup>

      <DetailGroup title="耗时">
        <DetailField
          label={"上游响应头"}
          value={formatOptionalMilliseconds(detail.upstreamResponseHeadersMs)}
        />
        <DetailField
          label={"上游首块"}
          value={formatOptionalMilliseconds(
            detail.upstreamFirstBodyChunkMs ?? detail.upstreamFirstByteMs,
          )}
        />
        <DetailField
          label={"代理首块"}
          value={formatOptionalMilliseconds(detail.firstClientFlushMs)}
        />
        <DetailField
          label={"代理有效输出"}
          value={formatOptionalMilliseconds(detail.firstOutputMs)}
        />
      </DetailGroup>
    </div>
  );
}

type DetailSectionProps = {
  title: string;
  value: string | null;
};

function DetailSection({ title, value }: DetailSectionProps) {
  const content = value?.trim() ? value : null;
  if (!content) {
    return null;
  }
  return (
    <section className="space-y-2.5 border-t border-border/60 pt-4">
      <h3 className="text-[13px] font-semibold leading-5 text-foreground">
        {title}
      </h3>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-muted/20 px-3.5 py-3 font-mono text-[12px] leading-5 text-foreground/85">
        {content}
      </pre>
    </section>
  );
}

function formatMilliseconds(value: number) {
  return `${formatInteger(value)} ms`;
}

function formatOptionalMilliseconds(value: number | null | undefined) {
  return value == null ? DETAIL_PLACEHOLDER : formatMilliseconds(value);
}

type RequestDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: DetailStatus;
  statusMessage: string;
  detail: RequestLogDetail | null;
  formatter: Intl.DateTimeFormat;
};

function RequestDetailSheet({
  open,
  onOpenChange,
  status,
  statusMessage,
  detail,
  formatter,
}: RequestDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0">
        <SheetHeader className="shrink-0 gap-1 border-b border-border/60 px-5 py-4 pr-14">
          <SheetTitle className="text-[15px] leading-5">
            {"请求详情"}
          </SheetTitle>
          <SheetDescription className="text-[12px] leading-4">
            {"请求头/体仅在开启记录后出现；错误响应会在失败请求中始终记录。"}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-none">
          <div className="px-5 py-5">
            {status === "loading" ? (
              <p className="text-[13px] text-muted-foreground">
                {"加载中…"}
              </p>
            ) : null}
            {status === "error" ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" aria-hidden="true" />
                <div>
                  <AlertTitle>{"加载失败"}</AlertTitle>
                  <AlertDescription>{statusMessage}</AlertDescription>
                </div>
              </Alert>
            ) : null}
            {status === "idle" && detail ? (
              <div className="space-y-4">
                <BasicInfoSection detail={detail} formatter={formatter} />
                <DetailSection
                  title={"用量详情"}
                  value={detail.usageJson}
                />
                <DetailSection
                  title={"请求头"}
                  value={detail.requestHeaders}
                />
                <DetailSection
                  title={"请求体"}
                  value={detail.requestBody}
                />
                <DetailSection
                  title={"错误响应"}
                  value={getResponseDetailValue(detail)}
                />
              </div>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function LogsPanel() {
  const {
    snapshot,
    status,
    statusMessage,
    rangePreset,
    selectedUpstreamId,
    selectedModel,
    upstreamOptions,
    modelOptions,
    pagination,
    refresh,
    onRangeChange,
    onUpstreamChange,
    onModelChange,
    onPrevPage,
    onNextPage,
  } = useDashboardSnapshot();

  const formatter = createDashboardTimeFormatter("zh-CN");

  const [captureState, setCaptureState] =
    useState<RequestDetailCaptureState>(IDLE_CAPTURE_STATE);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureNowMs, setCaptureNowMs] = useState(() => Date.now());
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStatus, setDetailStatus] = useState<DetailStatus>("idle");
  const [detailMessage, setDetailMessage] = useState("");
  const [detail, setDetail] = useState<RequestLogDetail | null>(null);
  const detailRequestSeq = useRef(0);

  const isLoading = status === "loading";
  const captureEnabled = isCaptureWindowActive(captureState, captureNowMs);
  const captureRemainingSeconds = getCaptureRemainingSeconds(
    captureState,
    captureNowMs,
  );
  const captureStatusText = captureRemainingSeconds
    ? `剩余 ${captureRemainingSeconds}s`
    : "";

  const updateCaptureState = useCallback(
    (nextState: RequestDetailCaptureState) => {
      setCaptureState(nextState);
      setCaptureNowMs(Date.now());
    },
    [],
  );

  const loadCaptureState = useCallback(async () => {
    try {
      const nextState = await readRequestDetailCapture();
      updateCaptureState(nextState);
    } catch {
      // ignore
    }
  }, [updateCaptureState]);

  useEffect(() => {
    void loadCaptureState();
  }, [loadCaptureState]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const stop = await listen<RequestDetailCaptureEvent>(
          REQUEST_DETAIL_CAPTURE_EVENT,
          (event) => {
            if (!active) {
              return;
            }
            updateCaptureState(event.payload);
          },
        );
        if (!active) {
          stop();
          return;
        }
        unlisten = stop;
      } catch {
        // ignore
      }
    };

    void setupListener();

    return () => {
      active = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, [updateCaptureState]);

  useEffect(() => {
    if (!captureEnabled) {
      return;
    }
    setCaptureNowMs(Date.now());
    const timerId = window.setInterval(() => {
      setCaptureNowMs(Date.now());
    }, CAPTURE_COUNTDOWN_TICK_MS);
    return () => {
      window.clearInterval(timerId);
    };
  }, [captureEnabled, captureState.expiresAtMs]);

  useEffect(() => {
    if (!captureState.enabled || captureState.expiresAtMs === null) {
      return;
    }
    const timeoutMs = Math.max(captureState.expiresAtMs - Date.now(), 0) + 50;
    const timeoutId = window.setTimeout(() => {
      void loadCaptureState();
    }, timeoutMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [captureState.enabled, captureState.expiresAtMs, loadCaptureState]);

  const handleToggleCapture = useCallback(
    async (nextValue: boolean) => {
      setCaptureLoading(true);
      try {
        const nextState = await setRequestDetailCapture(nextValue);
        updateCaptureState(nextState);
      } catch {
        // ignore
      } finally {
        setCaptureLoading(false);
      }
    },
    [updateCaptureState],
  );

  const handleSelectItem = useCallback(async (itemId: number) => {
    const requestId = detailRequestSeq.current + 1;
    detailRequestSeq.current = requestId;
    setDetailOpen(true);
    setDetail(null);
    setDetailStatus("loading");
    setDetailMessage("");

    try {
      const data = await readRequestLogDetail(itemId);
      if (detailRequestSeq.current === requestId) {
        setDetail(data);
        setDetailStatus("idle");
      }
    } catch (error) {
      if (detailRequestSeq.current === requestId) {
        setDetailMessage(parseError(error));
        setDetailStatus("error");
      }
    }
  }, []);

  const handleDetailOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setDetailOpen(true);
      return;
    }

    detailRequestSeq.current += 1;
    setDetailOpen(false);
    setDetail(null);
    setDetailStatus("idle");
    setDetailMessage("");
  }, []);

  useEffect(() => {
    return () => {
      detailRequestSeq.current += 1;
    };
  }, []);

  return (
    <div
      data-testid="logs-panel"
      className="flex h-full min-h-0 flex-1 flex-col gap-4"
    >
      {status === "error" ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <div>
            <AlertTitle>{"加载失败"}</AlertTitle>
            <AlertDescription>{statusMessage}</AlertDescription>
          </div>
        </Alert>
      ) : null}

      <DashboardFilters
        range={rangePreset}
        upstreamId={selectedUpstreamId}
        upstreamOptions={upstreamOptions}
        model={selectedModel}
        modelOptions={modelOptions}
        loading={isLoading}
        onRangeChange={onRangeChange}
        onUpstreamChange={onUpstreamChange}
        onModelChange={onModelChange}
        onRefresh={refresh}
        capture={{
          enabled: captureEnabled,
          loading: captureLoading,
          statusText: captureStatusText,
          onToggle: handleToggleCapture,
        }}
      />

      <DataTable
        items={snapshot?.recent ?? []}
        page={pagination.page}
        totalPages={pagination.totalPages}
        loading={isLoading}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        onSelectItem={(item) => handleSelectItem(item.id)}
      />

      <RequestDetailSheet
        open={detailOpen}
        onOpenChange={handleDetailOpenChange}
        status={detailStatus}
        statusMessage={detailMessage}
        detail={detail}
        formatter={formatter}
      />
    </div>
  );
}
