import { AlertCircle } from "lucide-react";
import { lazy, Suspense } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SectionCards } from "@/features/dashboard/components/section-cards";
import {
  DashboardFilters,
  useDashboardSnapshot,
} from "@/features/dashboard/snapshot";
import { useDashboardViewState } from "@/features/dashboard/state";

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
  const { autoRefreshEnabled, setAutoRefreshEnabled } = useDashboardViewState();
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
    modelDiscoveryLoading,
    refresh,
    onRangeChange,
    onUpstreamChange,
    onModelChange,
  } = useDashboardSnapshot({
    autoRefreshEnabled,
    refreshModelDiscoveryOnRefresh: true,
  });

  const isLoading = status === "loading" || modelDiscoveryLoading;

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
        autoRefresh={{
          enabled: autoRefreshEnabled,
          onToggle: setAutoRefreshEnabled,
        }}
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
