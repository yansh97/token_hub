import { useCallback, useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canStartUpdateCheck,
  formatBytes,
  useUpdater,
  type DownloadState,
  type UpdateInfo,
  type UpdateStatus,
} from "@/features/update/updater";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function resolveStatusBadge(status: UpdateStatus) {
  let label = "待检查";
  let variant: BadgeVariant = "outline";

  switch (status) {
    case "checking":
      label = "检查中";
      variant = "secondary";
      break;
    case "available":
      label = "可更新";
      variant = "default";
      break;
    case "uptodate":
      label = "已是最新";
      variant = "outline";
      break;
    case "downloading":
      label = "下载中";
      variant = "secondary";
      break;
    case "installing":
      label = "安装中";
      variant = "secondary";
      break;
    case "installed":
      label = "已安装";
      variant = "default";
      break;
    case "error":
      label = "更新失败";
      variant = "destructive";
      break;
    default:
      break;
  }

  return { label, variant };
}

function useAppVersion() {
  const [currentVersion, setCurrentVersion] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getVersion()
      .then((version) => {
        if (!cancelled) {
          setCurrentVersion(version);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return currentVersion;
}

type UpdateStatusRowProps = {
  currentVersion: string;
  badge: { label: string; variant: BadgeVariant };
  lastCheckedAt: string;
};

function UpdateStatusRow({
  currentVersion,
  badge,
  lastCheckedAt,
}: UpdateStatusRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="text-muted-foreground">当前版本</span>
        <span className="font-mono text-[12px] text-foreground/80">
          {currentVersion || "--"}
        </span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      {lastCheckedAt ? (
        <p className="text-[11px] leading-4 text-muted-foreground">
          上次检查：{lastCheckedAt}
        </p>
      ) : null}
    </div>
  );
}

type UpdateDetailsProps = {
  updateInfo: UpdateInfo | null;
};

function UpdateDetails({ updateInfo }: UpdateDetailsProps) {
  if (!updateInfo) {
    return null;
  }

  return (
    <div className="space-y-2 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">最新版本</span>
        <span className="font-mono text-[12px] text-foreground/80">
          {updateInfo.version}
        </span>
      </div>
      {updateInfo.date ? (
        <div className="text-[11px] leading-4 text-muted-foreground">
          发布日期：{updateInfo.date}
        </div>
      ) : null}
      <div>
        <p className="text-[11px] font-medium text-muted-foreground">
          更新说明
        </p>
        <div className="mt-1 rounded-md border border-border/60 bg-background/60 p-2.5 text-[12px] leading-5 text-muted-foreground whitespace-pre-wrap">
          {updateInfo.body || "暂无更新说明。"}
        </div>
      </div>
    </div>
  );
}

type UpdateProgressProps = {
  label: string;
};

function UpdateProgress({ label }: UpdateProgressProps) {
  if (!label) {
    return null;
  }
  return (
    <div className="text-[12px] leading-4 text-muted-foreground">{label}</div>
  );
}

type UpdateErrorProps = {
  message: string;
};

function UpdateError({ message }: UpdateErrorProps) {
  if (!message) {
    return null;
  }
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-[12px] text-destructive">
      <div className="flex items-center gap-2">
        <AlertCircle className="size-4" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  );
}

type UpdateActionsProps = {
  canCheck: boolean;
  canInstall: boolean;
  canRelaunch: boolean;
  onCheck: () => void;
  onInstall: () => void;
  onRelaunch: () => void;
};

function UpdateActions({
  canCheck,
  canInstall,
  canRelaunch,
  onCheck,
  onInstall,
  onRelaunch,
}: UpdateActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCheck}
        disabled={!canCheck}
      >
        检查更新
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onInstall}
        disabled={!canInstall}
      >
        下载并安装
      </Button>
      {canRelaunch ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onRelaunch}
        >
          立即重启
        </Button>
      ) : null}
    </div>
  );
}

function resolveProgressLabel(
  status: UpdateStatus,
  downloadState: DownloadState,
) {
  if (status !== "downloading") {
    return "";
  }
  const total = downloadState.total;
  const downloaded = downloadState.downloaded;
  if (!total && !downloaded) {
    return "";
  }
  return `下载进度：${formatBytes(downloaded)} / ${total ? formatBytes(total) : "--"}`;
}

export function UpdateCard() {
  const currentVersion = useAppVersion();
  const { state, actions } = useUpdater();
  const statusBadge = useMemo(
    () => resolveStatusBadge(state.status),
    [state.status],
  );
  const progressLabel = useMemo(
    () => resolveProgressLabel(state.status, state.downloadState),
    [state.downloadState, state.status],
  );
  const canCheck = canStartUpdateCheck(state.status);
  const canInstall = state.status === "available" && !!state.updateHandle;
  const canRelaunch = state.status === "installed";
  const triggerManualCheck = useCallback(() => {
    void actions.checkForUpdate({ source: "manual" });
  }, [actions]);

  return (
    <section
      data-slot="update-card"
      className="mt-5 border-t border-border/70 pt-5 pb-1"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold leading-5">应用更新</h2>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            检查并安装最新稳定版本。
          </p>
        </div>
        <div>
          <UpdateActions
            canCheck={canCheck}
            canInstall={canInstall}
            canRelaunch={canRelaunch}
            onCheck={triggerManualCheck}
            onInstall={actions.downloadAndInstall}
            onRelaunch={actions.relaunchApp}
          />
        </div>
      </div>
      <div className="space-y-3 pt-3">
        <UpdateStatusRow
          currentVersion={currentVersion}
          badge={statusBadge}
          lastCheckedAt={state.lastCheckedAt}
        />
        <UpdateDetails updateInfo={state.updateInfo} />
        <UpdateProgress label={progressLabel} />
        <UpdateError message={state.statusMessage} />
      </div>
    </section>
  );
}
