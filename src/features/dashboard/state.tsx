import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useMemo,
  useState,
} from "react";

import type { DashboardTimeRange } from "@/features/dashboard/range";

type DashboardViewState = {
  rangePreset: DashboardTimeRange;
  setRangePreset: Dispatch<SetStateAction<DashboardTimeRange>>;
  selectedUpstreamId: string | null;
  setSelectedUpstreamId: Dispatch<SetStateAction<string | null>>;
  selectedModel: string | null;
  setSelectedModel: Dispatch<SetStateAction<string | null>>;
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: Dispatch<SetStateAction<boolean>>;
};

const DashboardViewStateContext = createContext<DashboardViewState | null>(
  null,
);

export function DashboardViewStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [rangePreset, setRangePreset] = useState<DashboardTimeRange>("today");
  const [selectedUpstreamId, setSelectedUpstreamId] = useState<string | null>(
    null,
  );
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const value = useMemo(
    () => ({
      rangePreset,
      setRangePreset,
      selectedUpstreamId,
      setSelectedUpstreamId,
      selectedModel,
      setSelectedModel,
      autoRefreshEnabled,
      setAutoRefreshEnabled,
    }),
    [rangePreset, selectedUpstreamId, selectedModel, autoRefreshEnabled],
  );

  return (
    <DashboardViewStateContext.Provider value={value}>
      {children}
    </DashboardViewStateContext.Provider>
  );
}

export function useDashboardViewState() {
  const state = useContext(DashboardViewStateContext);
  if (!state) {
    throw new Error(
      "useDashboardViewState must be used within DashboardViewStateProvider.",
    );
  }
  return state;
}
