import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, Clock3 } from "lucide-react";

import type {
  DashboardUpstreamModelProbe,
  DashboardUpstreamModelProbeStatus,
} from "@/features/dashboard/types";
import { cn } from "@/lib/utils";

type UpstreamModelProbesProps = {
  probes: DashboardUpstreamModelProbe[];
};

const STATUS_ICON = {
  pending: Clock3,
  ok: CheckCircle2,
  failed: AlertTriangle,
  unsupported: Ban,
} satisfies Record<DashboardUpstreamModelProbeStatus, typeof Clock3>;

const STATUS_CLASS_NAME = {
  pending: "text-muted-foreground",
  ok: "text-success",
  failed: "text-destructive",
  unsupported: "text-muted-foreground",
} satisfies Record<DashboardUpstreamModelProbeStatus, string>;

function statusLabel(status: DashboardUpstreamModelProbeStatus) {
  switch (status) {
    case "pending":
      return "检查中";
    case "ok":
      return "可用";
    case "failed":
      return "失败";
    case "unsupported":
      return "不支持";
  }
}

function providerLabel(probe: DashboardUpstreamModelProbe) {
  if (probe.accountId) {
    return `${probe.provider} · ${probe.accountId}`;
  }
  return probe.provider;
}

function ProbeStatus({
  status,
}: {
  status: DashboardUpstreamModelProbeStatus;
}) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px]",
        STATUS_CLASS_NAME[status],
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span>{statusLabel(status)}</span>
    </span>
  );
}

function ProbeModels({ models }: { models: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // The grid is absent until models arrive, so reconnect when its mount condition changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: models.length controls that condition.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateWidth = () => setContainerWidth(node.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, [models.length]);

  if (models.length === 0) {
    return <span className="text-[13px] text-muted-foreground">暂无模型</span>;
  }

  const minColumnWidth = 176;
  const columnGap = 16;
  const widthColumnCount = containerWidth
    ? Math.max(
        1,
        Math.floor((containerWidth + columnGap) / (minColumnWidth + columnGap)),
      )
    : 1;
  const columnCount = widthColumnCount;
  const rowCount = Math.ceil(models.length / columnCount);

  return (
    <div
      ref={containerRef}
      className="grid min-w-0 gap-x-4 gap-y-1"
      style={{
        gridAutoFlow: "column",
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rowCount}, minmax(0, auto))`,
      }}
    >
      {models.map((model) => (
        <span
          key={model}
          className="truncate text-[12px] leading-5 text-foreground/80"
          title={model}
        >
          {model}
        </span>
      ))}
    </div>
  );
}

function ProbeRow({
  probe,
  index,
}: {
  probe: DashboardUpstreamModelProbe;
  index: number;
}) {
  return (
    <div
      className="border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
      data-testid={`upstream-model-probe-${index}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[13px] font-semibold leading-5">
              {probe.upstreamId}
            </span>
            <span className="truncate text-[12px] leading-5 text-muted-foreground">
              {providerLabel(probe)}
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <ProbeStatus status={probe.status} />
          <span className="text-[12px] text-muted-foreground">
            {probe.models.length} 个模型
          </span>
        </div>
      </div>
      <div className="mt-2.5 min-w-0">
        <ProbeModels models={probe.models} />
        {probe.error ? (
          <p className="mt-2 line-clamp-2 text-[12px] text-destructive">
            {probe.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function UpstreamModelProbes({ probes }: UpstreamModelProbesProps) {
  return (
    <section className="border-t border-border/70 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold leading-5">提供商模型</h2>
        <span className="text-[11px] text-muted-foreground">
          {probes.length} 个来源
        </span>
      </div>
      <div>
        {probes.length > 0 ? (
          probes.map((probe, index) => (
            <ProbeRow key={probe.upstreamId} probe={probe} index={index} />
          ))
        ) : (
          <div className="text-[13px] text-muted-foreground">
            暂无提供商模型
          </div>
        )}
      </div>
    </section>
  );
}
