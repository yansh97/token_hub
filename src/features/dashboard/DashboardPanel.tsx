import { lazy, Suspense } from "react";
import { AlertCircle } from "lucide-react";

import { SectionCards } from "@/features/dashboard/components/section-cards";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DashboardFilters,
  useDashboardSnapshot,
} from "@/features/dashboard/snapshot";
import { m } from "@/paraglide/messages.js";

const ChartAreaInteractive = lazy(() =>
  import("@/features/dashboard/components/chart-area-interactive").then(
    (module) => ({
      default: module.ChartAreaInteractive,
    }),
  ),
);
const ChartModelUsage = lazy(() =>
  import("@/features/dashboard/components/chart-usage-ranking").then(
    (module) => ({
      default: module.ChartModelUsage,
    }),
  ),
);
const UpstreamModelProbes = lazy(() =>
  import("@/features/dashboard/components/upstream-model-probes").then(
    (module) => ({
      default: module.UpstreamModelProbes,
    }),
  ),
);

function ChartAreaFallback() {
  return (
    <div aria-hidden="true" className="h-full min-h-[250px] bg-muted/20" />
  );
}

function ModelUsageFallback() {
  return (
    <div aria-hidden="true" className="h-full min-h-[250px] bg-muted/20" />
  );
}

export function DashboardPanel() {
  const {
    snapshot,
    status,
    statusMessage,
    activeRange,
    rangePreset,
    selectedUpstreamId,
    upstreamOptions,
    refresh,
    onRangeChange,
    onUpstreamChange,
  } = useDashboardSnapshot({ refreshModelDiscoveryOnRefresh: true });

  const isLoading = status === "loading";

  return (
    <div className="flex flex-col">
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
        loading={isLoading}
        onRangeChange={onRangeChange}
        onUpstreamChange={onUpstreamChange}
        onRefresh={refresh}
        className="mb-2.5"
      />

      <SectionCards summary={snapshot?.summary ?? null} />

      <div className="relative mx-4 mt-2.5 grid gap-2.5 pb-3 pt-3 before:absolute before:inset-x-4 before:top-0 before:border-t before:border-border/70 before:content-[''] lg:mx-6 lg:auto-rows-[250px] lg:grid-cols-2">
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
        <div className="mt-2.5">
          <UpstreamModelProbes probes={snapshot?.modelProbes ?? []} />
        </div>
      </Suspense>
    </div>
  );
}
