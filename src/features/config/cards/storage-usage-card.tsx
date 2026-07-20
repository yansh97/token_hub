import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBytes } from "@/features/update/updater";
import { parseError } from "@/lib/error";
import { m } from "@/paraglide/messages.js";

type DataStorageUsage = {
  dataDir: string;
  totalBytes: number;
  databaseBytes: number;
  configBytes: number;
  otherBytes: number;
};

type LoadStatus = "idle" | "loading" | "error";

type StorageMetricProps = {
  label: string;
  value: string;
};

function StorageMetric({ label, value }: StorageMetricProps) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] leading-4 text-muted-foreground">{label}</p>
      <p className="text-[13px] font-medium leading-5 tabular-nums">{value}</p>
    </div>
  );
}

export function StorageUsageCard() {
  const [usage, setUsage] = useState<DataStorageUsage | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const requestSeq = useRef(0);

  const loadUsage = useCallback(async () => {
    const requestId = requestSeq.current + 1;
    requestSeq.current = requestId;
    try {
      const next = await invoke<DataStorageUsage>("read_data_storage_usage");
      if (requestSeq.current !== requestId) {
        return;
      }
      setUsage(next);
      setStatus("idle");
    } catch (error) {
      if (requestSeq.current !== requestId) {
        return;
      }
      setUsage(null);
      setStatus("error");
      setErrorMessage(parseError(error));
    }
  }, []);

  useEffect(() => {
    // Tauri 数据读取在 await 后更新状态；规则无法跨回调识别这一点。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsage();
  }, [loadUsage]);

  const isLoading = status === "loading";
  const errorText = m.storage_usage_error({
    message: errorMessage || m.common_unknown(),
  });

  return (
    <Card
      data-slot="storage-usage-card"
      data-testid="storage-usage-card"
      className="gap-0 rounded-none border-0 bg-transparent py-4 shadow-none first:pt-2"
    >
      <CardHeader className="gap-1 px-0 pb-3 pt-0">
        <CardTitle className="text-[15px] leading-5">
          {m.storage_usage_title()}
        </CardTitle>
        <CardDescription className="text-[12px] leading-4">
          {m.storage_usage_desc()}
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => {
              setStatus("loading");
              setErrorMessage("");
              void loadUsage();
            }}
            disabled={isLoading}
            aria-label={m.storage_usage_refresh()}
          >
            <RefreshCw
              className={isLoading ? "animate-spin" : undefined}
              aria-hidden="true"
            />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3 px-0">
        <div className="flex min-w-0 items-center justify-between gap-4 text-[12px]">
          <span className="shrink-0 text-muted-foreground">
            {m.storage_usage_data_dir_label()}
          </span>
          <span className="min-w-0 truncate font-mono text-foreground/80">
            {usage?.dataDir || "--"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <StorageMetric
            label={m.storage_usage_total_label()}
            value={usage ? formatBytes(usage.totalBytes) : "--"}
          />
          <StorageMetric
            label={m.storage_usage_database_label()}
            value={usage ? formatBytes(usage.databaseBytes) : "--"}
          />
          <StorageMetric
            label={m.storage_usage_config_label()}
            value={usage ? formatBytes(usage.configBytes) : "--"}
          />
          <StorageMetric
            label={m.storage_usage_other_label()}
            value={usage ? formatBytes(usage.otherBytes) : "--"}
          />
        </div>
        {isLoading ? (
          <p className="text-[12px] leading-4 text-muted-foreground">
            {m.storage_usage_loading()}
          </p>
        ) : null}
        {status === "error" ? (
          <p className="text-[12px] leading-4 text-destructive">
            {errorText}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
