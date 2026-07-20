import { useCallback, useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  canStartUpdateCheck,
  formatBytes,
  useUpdater,
  type DownloadState,
  type UpdateInfo,
  type UpdateStatus,
} from "@/features/update/updater";
import { m } from "@/paraglide/messages.js";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function resolveStatusBadge(status: UpdateStatus) {
  let label = m.update_status_idle();
  let variant: BadgeVariant = "outline";

  switch (status) {
    case "checking":
      label = m.update_status_checking();
      variant = "secondary";
      break;
    case "available":
      label = m.update_status_available();
      variant = "default";
      break;
    case "uptodate":
      label = m.update_status_uptodate();
      variant = "outline";
      break;
    case "downloading":
      label = m.update_status_downloading();
      variant = "secondary";
      break;
    case "installing":
      label = m.update_status_installing();
      variant = "secondary";
      break;
    case "installed":
      label = m.update_status_installed();
      variant = "default";
      break;
    case "error":
      label = m.update_status_error();
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
        <span className="text-muted-foreground">
          {m.update_current_version_label()}
        </span>
        <span className="font-mono text-[12px] text-foreground/80">
          {currentVersion || "--"}
        </span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      {lastCheckedAt ? (
        <p className="text-[11px] leading-4 text-muted-foreground">
          {m.update_last_checked({ time: lastCheckedAt })}
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
        <span className="text-muted-foreground">
          {m.update_latest_version_label()}
        </span>
        <span className="font-mono text-[12px] text-foreground/80">
          {updateInfo.version}
        </span>
      </div>
      {updateInfo.date ? (
        <div className="text-[11px] leading-4 text-muted-foreground">
          {m.update_release_date_label()} {updateInfo.date}
        </div>
      ) : null}
      <div>
        <p className="text-[11px] font-medium text-muted-foreground">
          {m.update_release_notes_label()}
        </p>
        <div className="mt-1 rounded-md border border-border/60 bg-background/60 p-2.5 text-[12px] leading-5 text-muted-foreground whitespace-pre-wrap">
          {updateInfo.body || m.update_release_notes_empty()}
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
  return <div className="text-[12px] leading-4 text-muted-foreground">{label}</div>;
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
        {m.update_check()}
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onInstall}
        disabled={!canInstall}
      >
        {m.update_download_install()}
      </Button>
      {canRelaunch ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onRelaunch}
        >
          {m.update_restart_now()}
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
  return m.update_download_progress({
    downloaded: formatBytes(downloaded),
    total: total ? formatBytes(total) : "--",
  });
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
    <Card
      data-slot="update-card"
      className="gap-0 rounded-none border-0 bg-transparent py-4 pb-6 shadow-none"
    >
      <CardHeader className="gap-1 px-0 py-0">
        <CardTitle className="text-[15px] leading-5">
          {m.update_title()}
        </CardTitle>
        <CardDescription className="text-[12px] leading-4">
          {m.update_desc()}
        </CardDescription>
        <CardAction className="max-sm:col-span-2 max-sm:row-start-3 max-sm:justify-self-start max-sm:pt-2">
          <UpdateActions
            canCheck={canCheck}
            canInstall={canInstall}
            canRelaunch={canRelaunch}
            onCheck={triggerManualCheck}
            onInstall={actions.downloadAndInstall}
            onRelaunch={actions.relaunchApp}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3 px-0 pt-3">
        <UpdateStatusRow
          currentVersion={currentVersion}
          badge={statusBadge}
          lastCheckedAt={state.lastCheckedAt}
        />
        <UpdateDetails updateInfo={state.updateInfo} />
        <UpdateProgress label={progressLabel} />
        <UpdateError message={state.statusMessage} />
      </CardContent>
    </Card>
  );
}
