import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatBytes } from "@/features/update/updater";
import { parseError } from "@/lib/error";

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
  const errorText = `读取存储占用失败：${errorMessage || "未知错误"}`;

  return (
    <section
      data-slot="storage-usage-card"
      data-testid="storage-usage-card"
      className="mt-5 border-t border-border/70 pt-5"
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-5">存储占用</h2>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            应用数据、数据库和配置文件的磁盘占用。
          </p>
        </div>
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
          aria-label="刷新存储占用"
        >
          <RefreshCw
            className={isLoading ? "animate-spin" : undefined}
            aria-hidden="true"
          />
        </Button>
      </div>
      <div className="mt-3 space-y-3">
        <div className="flex min-w-0 items-center justify-between gap-4 text-[12px]">
          <span className="shrink-0 text-muted-foreground">数据目录</span>
          <span className="min-w-0 truncate font-mono text-foreground/80">
            {usage?.dataDir || "--"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <StorageMetric
            label="合计"
            value={usage ? formatBytes(usage.totalBytes) : "--"}
          />
          <StorageMetric
            label="数据库"
            value={usage ? formatBytes(usage.databaseBytes) : "--"}
          />
          <StorageMetric
            label="配置"
            value={usage ? formatBytes(usage.configBytes) : "--"}
          />
          <StorageMetric
            label="其他"
            value={usage ? formatBytes(usage.otherBytes) : "--"}
          />
        </div>
        {isLoading ? (
          <p className="text-[12px] leading-4 text-muted-foreground">
            正在计算占用...
          </p>
        ) : null}
        {status === "error" ? (
          <p className="text-[12px] leading-4 text-destructive">{errorText}</p>
        ) : null}
      </div>
    </section>
  );
}
