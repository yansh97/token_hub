import { Loader2, Play, RefreshCw, RotateCcw, Square } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  ProxyServiceRequestState,
  ProxyServiceStatus,
} from "@/features/config/types";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

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
      label: m.proxy_service_badge_error(),
      variant: "destructive" as const,
    };
  }
  if (!status) {
    return {
      label: m.proxy_service_badge_unknown(),
      variant: "outline" as const,
    };
  }
  if (status.state === "running") {
    return {
      label: m.proxy_service_badge_running(),
      variant: "default" as const,
    };
  }
  return {
    label: m.proxy_service_badge_stopped(),
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
        <span className="text-muted-foreground">
          {m.proxy_service_state_label()}
        </span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">
          {m.proxy_service_addr_label()}
        </span>
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
        aria-label={m.common_refresh()}
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
        {m.proxy_service_start()}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onStop}
        disabled={isWorking || !isRunning}
      >
        <Square aria-hidden="true" />
        {m.proxy_service_stop()}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRestart}
        disabled={isWorking || !isRunning || isDirty}
      >
        <RotateCcw aria-hidden="true" />
        {m.proxy_service_restart()}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onReload}
        disabled={isWorking || isDirty}
      >
        {m.proxy_service_reload_config()}
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
      {m.proxy_service_unsaved_notice()}
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
          {m.proxy_service_title()}
        </p>
        <p className="text-[13px] leading-5 text-muted-foreground">
          {m.proxy_service_desc()}
        </p>
      </div>
      <ProxyServiceContent {...props} />
    </section>
  );
}
