import { AlertCircle } from "lucide-react";
import { useMemo } from "react";

import { AppShell } from "@/layouts/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AutoStartCard,
  ProxyCoreCard,
  StorageUsageCard,
  UpdateCard,
  UpstreamsCard,
  type StatusBadge,
} from "@/features/config/cards";
import type { ProxyServiceViewProps } from "@/features/config/cards/proxy-service-card";
import type { ConfigEditorSectionId } from "@/features/config/sections";
import { findSection } from "@/features/config/sections";
import type {
  ConfigForm,
  ProxyServiceRequestState,
  ProxyServiceStatus,
} from "@/features/config/types";
import { m } from "@/paraglide/messages.js";

type AppViewProps = {
  activeSectionId: ConfigEditorSectionId;
  form: ConfigForm;
  statusBadge: StatusBadge;
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
  validation: { valid: boolean; message: string };
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

type ValidationAlertProps = {
  validation: AppViewProps["validation"];
};

function ValidationAlert({ validation }: ValidationAlertProps) {
  if (validation.valid) {
    return null;
  }

  const message = validation.message || m.config_invalid_configuration();

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="size-4" aria-hidden="true" />
      <div className="flex flex-1 items-start gap-3">
        <div>
          <AlertTitle>{m.config_invalid_configuration()}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

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
          <AlertTitle>{m.config_request_failed_title()}</AlertTitle>
          <AlertDescription>{statusMessage}</AlertDescription>
        </div>
        {canRetrySave ? (
          <Button type="button" variant="outline" size="sm" onClick={onSave}>
            {m.config_retry_save()}
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
    case "core":
      return (
        <ProxyCoreCard
          form={props.form}
          showLocalKey={props.showLocalKey}
          onToggleLocalKey={props.onToggleLocalKey}
          onChange={props.onFormChange}
          proxyService={proxyService}
        />
      );
    case "upstreams":
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <UpstreamsCard
            upstreams={props.form.upstreams}
            showApiKeys={props.showUpstreamKeys}
            providerOptions={props.providerOptions}
            onToggleApiKeys={props.onToggleUpstreamKeys}
            onAdd={props.onAddUpstream}
            onRemove={props.onRemoveUpstream}
            onChange={props.onChangeUpstream}
          />
        </div>
      );
    case "settings":
      return (
        <div className="flex flex-col gap-4">
          <StorageUsageCard />
          <AutoStartCard
            enabled={props.autoStartEnabled}
            status={props.autoStartStatus}
            message={props.autoStartMessage}
            onChange={props.onAutoStartChange}
          />
          <UpdateCard />
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
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 lg:px-6">
      <ValidationAlert validation={props.validation} />
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
  const sectionMeta = useMemo(
    () => findSection(activeSectionId),
    [activeSectionId],
  );
  const proxyService = toProxyServiceViewProps(props);

  return (
    <AppShell title={sectionMeta.label()}>
      <ConfigSectionContent
        {...viewProps}
        activeSectionId={activeSectionId}
        proxyService={proxyService}
      />
    </AppShell>
  );
}
