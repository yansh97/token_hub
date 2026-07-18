import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Ban, CheckCircle2, Clock3 } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  DashboardUpstreamModelProbe,
  DashboardUpstreamModelProbeStatus,
} from "@/features/dashboard/types"
import { cn } from "@/lib/utils"
import { m } from "@/paraglide/messages.js"

type UpstreamModelProbesProps = {
  probes: DashboardUpstreamModelProbe[]
}

const STATUS_ICON = {
  pending: Clock3,
  ok: CheckCircle2,
  failed: AlertTriangle,
  unsupported: Ban,
} satisfies Record<DashboardUpstreamModelProbeStatus, typeof Clock3>

const STATUS_CLASS_NAME = {
  pending: "text-muted-foreground",
  ok: "text-emerald-600 dark:text-emerald-400",
  failed: "text-destructive",
  unsupported: "text-muted-foreground",
} satisfies Record<DashboardUpstreamModelProbeStatus, string>

function statusLabel(status: DashboardUpstreamModelProbeStatus) {
  switch (status) {
    case "pending":
      return m.dashboard_upstream_models_status_pending()
    case "ok":
      return m.dashboard_upstream_models_status_ok()
    case "failed":
      return m.dashboard_upstream_models_status_failed()
    case "unsupported":
      return m.dashboard_upstream_models_status_unsupported()
  }
}

function providerLabel(probe: DashboardUpstreamModelProbe) {
  if (probe.accountId) {
    return `${probe.provider} · ${probe.accountId}`
  }
  return probe.provider
}

function ProbeStatus({ status }: { status: DashboardUpstreamModelProbeStatus }) {
  const Icon = STATUS_ICON[status]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px]", STATUS_CLASS_NAME[status])}>
      <Icon className="size-3.5" aria-hidden="true" />
      <span>{statusLabel(status)}</span>
    </span>
  )
}

function ProbeModels({ models }: { models: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const node = containerRef.current
    if (!node || typeof ResizeObserver === "undefined") {
      return
    }

    const updateWidth = () => setContainerWidth(node.clientWidth)
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  if (models.length === 0) {
    return <span className="text-[13px] text-muted-foreground">{m.dashboard_upstream_models_empty()}</span>
  }

  const minColumnWidth = 176
  const columnGap = 16
  const columnCount = containerWidth
    ? Math.max(1, Math.floor((containerWidth + columnGap) / (minColumnWidth + columnGap)))
    : 1
  const rowCount = Math.ceil(models.length / columnCount)

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
        <span key={model} className="truncate text-[12px] leading-5 text-foreground/80" title={model}>
          {model}
        </span>
      ))}
    </div>
  )
}

function ProbeRow({
  probe,
  index,
}: {
  probe: DashboardUpstreamModelProbe
  index: number
}) {
  return (
    <div
      className="border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
      data-testid={`upstream-model-probe-${index}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] font-semibold leading-5">{probe.upstreamId}</span>
            <span className="truncate text-[12px] leading-5 text-muted-foreground">{providerLabel(probe)}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <ProbeStatus status={probe.status} />
          <span className="text-[12px] text-muted-foreground">
            {m.dashboard_upstream_models_count({ count: probe.models.length })}
          </span>
        </div>
      </div>
      <div className="mt-2.5 min-w-0">
        <ProbeModels models={probe.models} />
        {probe.error ? (
          <p className="mt-2 line-clamp-2 text-[12px] text-destructive">
            {m.dashboard_upstream_models_error({ error: probe.error })}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function UpstreamModelProbes({ probes }: UpstreamModelProbesProps) {
  return (
    <div className="border-border/70 border-t px-4 pt-3 lg:px-6">
      <Card className="h-full gap-0 rounded-none border-0 bg-transparent py-0 shadow-none">
        <CardHeader className="gap-1.5 px-4 py-3">
        <CardTitle className="text-[15px] font-semibold leading-5">{m.dashboard_upstream_models_title()}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          {probes.length > 0 ? (
            probes.map((probe, index) => (
              <ProbeRow
                key={`${probe.provider}:${probe.upstreamId}:${probe.accountId ?? "public"}:${index}`}
                probe={probe}
                index={index}
              />
            ))
          ) : (
            <div className="text-[13px] text-muted-foreground">
              {m.dashboard_upstream_models_empty()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
