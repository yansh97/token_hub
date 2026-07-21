import { lazy, Suspense } from "react";
import { AlertCircle } from "lucide-react";

import { SectionCards } from "@/features/dashboard/components/section-cards";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DashboardFilters,
  useDashboardSnapshot,
} from "@/features/dashboard/snapshot";

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
    selectedModel,
    upstreamOptions,
    modelOptions,
    refresh,
    onRangeChange,
    onUpstreamChange,
    onModelChange,
  } = useDashboardSnapshot({ refreshModelDiscoveryOnRefresh: true });

  const isLoading = status === "loading";

  return (
    <div className="flex flex-col gap-6">
      {status === "error" ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <div>
            <AlertTitle>仪表盘加载失败</AlertTitle>
            <AlertDescription>{statusMessage}</AlertDescription>
          </div>
        </Alert>
      ) : null}

      <DashboardFilters
        sticky
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
      />

      <SectionCards summary={snapshot?.summary ?? null} />

      <div
        data-slot="dashboard-charts"
        className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]"
      >
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
  );
}
