import { AlertCircle } from "lucide-react";

import { AppShell } from "@/layouts/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AutoStartCard,
  ProxyCoreCard,
  StorageUsageCard,
  UpdateCard,
  UpstreamsCard,
} from "@/features/config/cards";
import type { ProxyServiceViewProps } from "@/features/config/cards/proxy-service-card";
import type { ConfigEditorSectionId } from "@/features/config/sections";
import type {
  ConfigForm,
  ProxyServiceRequestState,
  ProxyServiceStatus,
} from "@/features/config/types";

type AppViewProps = {
  activeSectionId: ConfigEditorSectionId;
  form: ConfigForm;
  showLocalKey: boolean;
  showUpstreamKeys: boolean;
  providerOptions: string[];
  autoStartEnabled: boolean;
  autoStartStatus: "idle" | "loading" | "error";
  autoStartMessage: string;
  proxyServiceStatus: ProxyServiceStatus | null;
  proxyServiceRequestState: ProxyServiceRequestState;
  proxyServiceMessage: string;
  status: "idle" | "loading" | "saving" | "saved" | "error";
  statusMessage: string;
  canSave: boolean;
  isDirty: boolean;
  onToggleLocalKey: () => void;
  onToggleUpstreamKeys: () => void;
  onFormChange: (patch: Partial<ConfigForm>) => void;
  onAutoStartChange: (value: boolean) => void;
  onAddUpstream: (upstream: ConfigForm["upstreams"][number]) => void;
  onRemoveUpstream: (index: number) => void;
  onChangeUpstream: (
    index: number,
    patch: Partial<ConfigForm["upstreams"][number]>,
  ) => void;
  onSave: () => void;
  onProxyServiceRefresh: () => void;
  onProxyServiceStart: () => void;
  onProxyServiceStop: () => void;
  onProxyServiceRestart: () => void;
  onProxyServiceReload: () => void;
};

type StatusAlertProps = {
  status: AppViewProps["status"];
  statusMessage: string;
  canSave: boolean;
  isDirty: boolean;
  onSave: () => void;
};

function StatusAlert({
  status,
  statusMessage,
  canSave,
  isDirty,
  onSave,
}: StatusAlertProps) {
  if (status !== "error" || !statusMessage) {
    return null;
  }

  const canRetrySave = isDirty && canSave;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="size-4" aria-hidden="true" />
      <div className="flex flex-1 items-start justify-between gap-3">
        <div>
          <AlertTitle>请求失败</AlertTitle>
          <AlertDescription>{statusMessage}</AlertDescription>
        </div>
        {canRetrySave ? (
          <Button type="button" variant="outline" size="sm" onClick={onSave}>
            重试保存
          </Button>
        ) : null}
      </div>
    </Alert>
  );
}

type ConfigSectionContentProps = Omit<AppViewProps, "activeSectionId"> & {
  activeSectionId: ConfigEditorSectionId;
  proxyService: ProxyServiceViewProps;
};

type ConfigSectionBodyProps = ConfigSectionContentProps;

function ConfigSectionBody({
  activeSectionId,
  proxyService,
  ...props
}: ConfigSectionBodyProps) {
  switch (activeSectionId) {
    case "settings":
      return (
        <div
          data-slot="settings-content"
          className="flex w-full flex-col gap-0"
        >
          <ProxyCoreCard
            form={props.form}
            showLocalKey={props.showLocalKey}
            onToggleLocalKey={props.onToggleLocalKey}
            onChange={props.onFormChange}
            proxyService={proxyService}
          />
          <AutoStartCard
            enabled={props.autoStartEnabled}
            status={props.autoStartStatus}
            message={props.autoStartMessage}
            onChange={props.onAutoStartChange}
          />
          <StorageUsageCard />
          <UpdateCard />
        </div>
      );
    case "upstreams":
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <UpstreamsCard
            upstreams={props.form.upstreams}
            showApiKeys={props.showUpstreamKeys}
            providerOptions={props.providerOptions}
            appProxyUrl={props.form.appProxyUrl}
            onToggleApiKeys={props.onToggleUpstreamKeys}
            onAdd={props.onAddUpstream}
            onRemove={props.onRemoveUpstream}
            onChange={props.onChangeUpstream}
          />
        </div>
      );
    default:
      return null;
  }
}

function ConfigSectionContent({
  activeSectionId,
  proxyService,
  ...props
}: ConfigSectionContentProps) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <StatusAlert
        status={props.status}
        statusMessage={props.statusMessage}
        canSave={props.canSave}
        isDirty={props.isDirty}
        onSave={props.onSave}
      />
      <ConfigSectionBody
        {...props}
        activeSectionId={activeSectionId}
        proxyService={proxyService}
      />
    </div>
  );
}

function toProxyServiceViewProps(props: AppViewProps) {
  return {
    status: props.proxyServiceStatus,
    requestState: props.proxyServiceRequestState,
    message: props.proxyServiceMessage,
    isDirty: props.isDirty,
    onRefresh: props.onProxyServiceRefresh,
    onStart: props.onProxyServiceStart,
    onStop: props.onProxyServiceStop,
    onRestart: props.onProxyServiceRestart,
    onReload: props.onProxyServiceReload,
  };
}

export function AppView(props: AppViewProps) {
  const { activeSectionId, ...viewProps } = props;
  const proxyService = toProxyServiceViewProps(props);

  return (
    <AppShell
      contentMode={activeSectionId === "upstreams" ? "workspace" : "document"}
    >
      <ConfigSectionContent
        {...viewProps}
        activeSectionId={activeSectionId}
        proxyService={proxyService}
      />
    </AppShell>
  );
}
