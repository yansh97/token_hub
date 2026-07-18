import { lazy, Suspense } from "react"
import { AlertCircle } from "lucide-react"

import { SectionCards } from "@/features/dashboard/components/section-cards"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  DashboardFilters,
  useDashboardSnapshot,
} from "@/features/dashboard/snapshot"
import { m } from "@/paraglide/messages.js"

const ChartAreaInteractive = lazy(() =>
  import("@/features/dashboard/components/chart-area-interactive").then((module) => ({
    default: module.ChartAreaInteractive,
  }))
)
const ChartModelUsage = lazy(() =>
  import("@/features/dashboard/components/chart-usage-ranking").then((module) => ({
    default: module.ChartModelUsage,
  }))
)
const UpstreamModelProbes = lazy(() =>
  import("@/features/dashboard/components/upstream-model-probes").then((module) => ({
    default: module.UpstreamModelProbes,
  }))
)

function ChartAreaFallback() {
  return (
    <div
      aria-hidden="true"
      className="h-full min-h-[250px] bg-muted/20"
    />
  )
}

function ModelUsageFallback() {
  return (
    <div
      aria-hidden="true"
      className="h-full min-h-[250px] bg-muted/20"
    />
  )
}

export function DashboardPanel() {
  const {
    snapshot,
    status,
    statusMessage,
    activeRange,
    rangePreset,
    selectedUpstreamId,
    selectedAccountId,
    selectedPublicOnly,
    upstreamOptions,
    accountOptions,
    refresh,
    onRangeChange,
    onUpstreamChange,
    onAccountChange,
  } = useDashboardSnapshot({ refreshModelDiscoveryOnRefresh: true })

  const isLoading = status === "loading"

  return (
    <div className="flex flex-col gap-2.5">
      {status === "error" ? (
        <Alert variant="destructive" className="mx-4 lg:mx-6">
          <AlertCircle className="size-4" aria-hidden="true" />
          <div>
            <AlertTitle>{m.dashboard_load_failed()}</AlertTitle>
            <AlertDescription>{statusMessage}</AlertDescription>
          </div>
        </Alert>
      ) : null}

      <DashboardFilters
        range={rangePreset}
        upstreamId={selectedUpstreamId}
        upstreamOptions={upstreamOptions}
        accountId={selectedAccountId}
        publicOnly={selectedPublicOnly}
        accountOptions={accountOptions}
        loading={isLoading}
        onRangeChange={onRangeChange}
        onUpstreamChange={onUpstreamChange}
        onAccountChange={onAccountChange}
        onRefresh={refresh}
      />

      <SectionCards summary={snapshot?.summary ?? null} />

      <div className="border-border/70 grid gap-2.5 border-t px-4 pb-3 pt-3 lg:auto-rows-[250px] lg:grid-cols-2 lg:px-6">
        <Suspense fallback={<ChartAreaFallback />}>
          <ChartAreaInteractive
            series={snapshot?.series ?? []}
            range={activeRange}
          />
        </Suspense>

        <Suspense fallback={<ModelUsageFallback />}>
          <ChartModelUsage models={snapshot?.models ?? []} />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <UpstreamModelProbes probes={snapshot?.modelProbes ?? []} />
      </Suspense>
    </div>
  )
}
