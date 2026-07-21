import { Loader2, Play, RefreshCw, RotateCcw, Square } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  ProxyServiceRequestState,
  ProxyServiceStatus,
} from "@/features/config/types";
import { cn } from "@/lib/utils";

export type ProxyServiceViewProps = {
  status: ProxyServiceStatus | null;
  requestState: ProxyServiceRequestState;
  message: string;
  isDirty: boolean;
  onRefresh: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onReload: () => void;
};

function resolveBadge(status: ProxyServiceStatus | null, message: string) {
  const hasError = Boolean(message || status?.last_error);
  if (hasError) {
    return {
      label: "错误",
      variant: "destructive" as const,
    };
  }
  if (!status) {
    return {
      label: "未知",
      variant: "outline" as const,
    };
  }
  if (status.state === "running") {
    return {
      label: "运行中",
      variant: "default" as const,
    };
  }
  return {
    label: "已停止",
    variant: "secondary" as const,
  };
}

type ProxyServiceContentProps = ProxyServiceViewProps & { className?: string };

type ProxyServiceStatusRowProps = {
  badge: ReturnType<typeof resolveBadge>;
  addr: string;
};

function ProxyServiceStatusRow({ badge, addr }: ProxyServiceStatusRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">状态</span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">地址</span>
        <span className="font-mono text-[12px] text-foreground/80">{addr}</span>
      </div>
    </div>
  );
}

type ProxyServiceErrorProps = {
  message: string;
};

function ProxyServiceError({ message }: ProxyServiceErrorProps) {
  if (!message) {
    return null;
  }
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
      {message}
    </div>
  );
}

type ProxyServiceActionsProps = {
  isWorking: boolean;
  isRunning: boolean;
  isDirty: boolean;
  onRefresh: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onReload: () => void;
};

function ProxyServiceActions({
  isWorking,
  isRunning,
  isDirty,
  onRefresh,
  onStart,
  onStop,
  onRestart,
  onReload,
}: ProxyServiceActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={onRefresh}
        disabled={isWorking}
        aria-label="刷新服务状态"
      >
        <RefreshCw
          className={cn("size-4", isWorking && "animate-spin")}
          aria-hidden="true"
        />
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onStart}
        disabled={isWorking || isRunning}
      >
        {isWorking ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Play aria-hidden="true" />
        )}
        启动
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onStop}
        disabled={isWorking || !isRunning}
      >
        <Square aria-hidden="true" />
        停止
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRestart}
        disabled={isWorking || !isRunning || isDirty}
      >
        <RotateCcw aria-hidden="true" />
        重启
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onReload}
        disabled={isWorking || isDirty}
      >
        重新载入配置
      </Button>
    </div>
  );
}

type ProxyServiceDirtyNoticeProps = {
  isDirty: boolean;
};

function ProxyServiceDirtyNotice({ isDirty }: ProxyServiceDirtyNoticeProps) {
  if (!isDirty) {
    return null;
  }
  return (
    <div className="rounded-md border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
      当前有未保存的更改。保存后才能重启服务或重新载入配置。
    </div>
  );
}

function ProxyServiceContent({
  status,
  requestState,
  message,
  isDirty,
  onRefresh,
  onStart,
  onStop,
  onRestart,
  onReload,
  className,
}: ProxyServiceContentProps) {
  const isWorking = requestState === "working";
  const isRunning = status?.state === "running";
  const errorMessage = message || status?.last_error || "";
  const badge = resolveBadge(status, message);
  const addr = status?.addr || "--";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProxyServiceStatusRow badge={badge} addr={addr} />
        <ProxyServiceActions
          isWorking={isWorking}
          isRunning={isRunning}
          isDirty={isDirty}
          onRefresh={onRefresh}
          onStart={onStart}
          onStop={onStop}
          onRestart={onRestart}
          onReload={onReload}
        />
      </div>
      <ProxyServiceError message={errorMessage} />
      <ProxyServiceDirtyNotice isDirty={isDirty} />
    </div>
  );
}

type ProxyServicePanelProps = ProxyServiceViewProps & { className?: string };

export function ProxyServicePanel({
  className,
  ...props
}: ProxyServicePanelProps) {
  return (
    <section
      data-slot="proxy-service-panel"
      className={cn("space-y-4", className)}
    >
      <div className="space-y-1">
        <p className="text-[15px] font-semibold leading-5 text-foreground">
          代理服务
        </p>
        <p className="text-[13px] leading-5 text-muted-foreground">
          查看运行状态，并安全地启动、停止或重新载入服务。
        </p>
      </div>
      <ProxyServiceContent {...props} />
    </section>
  );
}
