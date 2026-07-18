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
import { Separator } from "@/components/ui/separator";
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

type StorageRowProps = {
  label: string;
  value: string;
  mono?: boolean;
};

function StorageRow({ label, value, mono = false }: StorageRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <p className="shrink-0 text-muted-foreground">{label}</p>
      <p
        className={
          mono
            ? "min-w-0 break-all text-right font-mono text-xs text-foreground/80"
            : "tabular-nums text-right text-foreground"
        }
      >
        {value}
      </p>
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
    setStatus("loading");
    setErrorMessage("");
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
    void loadUsage();
  }, [loadUsage]);

  const isLoading = status === "loading";
  const errorText = m.storage_usage_error({
    message: errorMessage || m.common_unknown(),
  });

  return (
    <Card data-slot="storage-usage-card" data-testid="storage-usage-card">
      <CardHeader>
        <CardTitle>{m.storage_usage_title()}</CardTitle>
        <CardDescription>{m.storage_usage_desc()}</CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
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
      <CardContent className="space-y-4">
        <StorageRow
          label={m.storage_usage_data_dir_label()}
          value={usage?.dataDir || "--"}
          mono
        />
        <Separator />
        <div className="space-y-2">
          <StorageRow
            label={m.storage_usage_total_label()}
            value={usage ? formatBytes(usage.totalBytes) : "--"}
          />
          <StorageRow
            label={m.storage_usage_database_label()}
            value={usage ? formatBytes(usage.databaseBytes) : "--"}
          />
          <StorageRow
            label={m.storage_usage_config_label()}
            value={usage ? formatBytes(usage.configBytes) : "--"}
          />
          <StorageRow
            label={m.storage_usage_other_label()}
            value={usage ? formatBytes(usage.otherBytes) : "--"}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {m.storage_usage_hint()}
        </p>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">
            {m.storage_usage_loading()}
          </p>
        ) : null}
        {status === "error" ? (
          <p className="text-xs text-destructive">{errorText}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
