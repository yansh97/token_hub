import { invoke } from "@tauri-apps/api/core";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { useCallback } from "react";
import { extractConfigExtras, toForm } from "@/features/config/form";
import type {
  ConfigForm,
  ConfigResponse,
  ProxyConfigFile,
  ProxyServiceStatus,
  SaveProxyConfigResult,
} from "@/features/config/types";
import { parseError } from "@/lib/error";

import type { AutoStartStatus, StatusState } from "./config-screen-state";

type ConfigActionsArgs = {
  currentPayload: ProxyConfigFile | null;
  validation: { valid: boolean; message: string };
  configDirty: boolean;
  autoStartEnabled: boolean;
  autoStartBaseline: boolean;
  autoStartStatus: AutoStartStatus;
  setForm: (value: ConfigForm) => void;
  setLastConfig: (value: ProxyConfigFile | null) => void;
  setConfigExtras: (extras: Record<string, unknown>) => void;
  setStatus: (value: StatusState) => void;
  setStatusMessage: (value: string) => void;
  setAutoStartEnabled: (value: boolean) => void;
  setAutoStartBaseline: (value: boolean) => void;
  setAutoStartStatus: (value: AutoStartStatus) => void;
  setAutoStartMessage: (value: string) => void;
  setProxyServiceStatus: (value: ProxyServiceStatus) => void;
  setProxyServiceMessage: (value: string) => void;
};

type AutoStartLoadArgs = {
  setAutoStartEnabled: (value: boolean) => void;
  setAutoStartBaseline: (value: boolean) => void;
  setAutoStartStatus: (value: AutoStartStatus) => void;
  setAutoStartMessage: (value: string) => void;
};

async function loadAutoStartImpl({
  setAutoStartEnabled,
  setAutoStartBaseline,
  setAutoStartStatus,
  setAutoStartMessage,
}: AutoStartLoadArgs) {
  setAutoStartStatus("loading");
  setAutoStartMessage("");
  try {
    const enabled = await isAutostartEnabled();
    setAutoStartEnabled(enabled);
    setAutoStartBaseline(enabled);
    setAutoStartStatus("idle");
  } catch (error) {
    setAutoStartStatus("error");
    setAutoStartMessage(parseError(error));
  }
}

type AutoStartApplyArgs = {
  enabled: boolean;
  baseline: boolean;
  status: AutoStartStatus;
  setAutoStartBaseline: (value: boolean) => void;
  setAutoStartStatus: (value: AutoStartStatus) => void;
  setAutoStartMessage: (value: string) => void;
};

async function applyAutoStartChange({
  enabled,
  baseline,
  status,
  setAutoStartBaseline,
  setAutoStartStatus,
  setAutoStartMessage,
}: AutoStartApplyArgs) {
  if (status === "loading" || enabled === baseline) {
    return { changed: false, error: "" };
  }
  setAutoStartStatus("loading");
  setAutoStartMessage("");
  try {
    if (enabled) {
      await enableAutostart();
    } else {
      await disableAutostart();
    }
    setAutoStartBaseline(enabled);
    setAutoStartStatus("idle");
    return { changed: true, error: "" };
  } catch (error) {
    const message = parseError(error);
    setAutoStartStatus("error");
    setAutoStartMessage(message);
    return { changed: false, error: message };
  }
}

type LoadConfigArgs = Pick<
  ConfigActionsArgs,
  "setForm" | "setLastConfig" | "setStatus" | "setStatusMessage"
> & {
  setConfigExtras: (extras: Record<string, unknown>) => void;
};

async function loadConfigImpl({
  setForm,
  setLastConfig,
  setConfigExtras,
  setStatus,
  setStatusMessage,
}: LoadConfigArgs) {
  setStatus("loading");
  setStatusMessage("");
  try {
    const response = await invoke<ConfigResponse>("read_proxy_config");
    setForm(toForm(response.config));
    setConfigExtras(extractConfigExtras(response.config));
    setLastConfig(response.config);
    setStatus("idle");
  } catch (error) {
    setStatus("error");
    setStatusMessage(parseError(error));
  }
}

type WriteConfigArgs = {
  configDirty: boolean;
  currentPayload: ProxyConfigFile;
  setLastConfig: (value: ProxyConfigFile | null) => void;
  setProxyServiceStatus: (value: ProxyServiceStatus) => void;
};

async function writeConfigIfDirty({
  configDirty,
  currentPayload,
  setLastConfig,
  setProxyServiceStatus,
}: WriteConfigArgs) {
  if (!configDirty) {
    return { saved: false, error: "" };
  }
  try {
    const result = await invoke<SaveProxyConfigResult>("save_proxy_config", {
      config: currentPayload,
    });
    setProxyServiceStatus(result.status);
    setLastConfig(currentPayload);
    return { saved: true, error: result.apply_error ?? "" };
  } catch (error) {
    return { saved: false, error: parseError(error) };
  }
}

type SaveConfigArgs = Pick<
  ConfigActionsArgs,
  | "setLastConfig"
  | "setStatus"
  | "setStatusMessage"
  | "setAutoStartBaseline"
  | "setAutoStartStatus"
  | "setAutoStartMessage"
  | "setProxyServiceStatus"
  | "setProxyServiceMessage"
> & {
  currentPayload: ProxyConfigFile | null;
  validation: { valid: boolean; message: string };
  configDirty: boolean;
  autoStartEnabled: boolean;
  autoStartBaseline: boolean;
  autoStartStatus: AutoStartStatus;
};

async function saveConfigImpl({
  currentPayload,
  validation,
  configDirty,
  autoStartEnabled,
  autoStartBaseline,
  autoStartStatus,
  setLastConfig,
  setStatus,
  setStatusMessage,
  setAutoStartBaseline,
  setAutoStartStatus,
  setAutoStartMessage,
  setProxyServiceStatus,
  setProxyServiceMessage,
}: SaveConfigArgs) {
  if (!currentPayload) {
    setStatus("error");
    setStatusMessage(validation.message || "配置无效。");
    return;
  }
  setStatus("saving");
  setStatusMessage("");
  setProxyServiceMessage("");
  const configResult = await writeConfigIfDirty({
    configDirty,
    currentPayload,
    setLastConfig,
    setProxyServiceStatus,
  });
  if (configResult.error) {
    setStatus("error");
    setStatusMessage(configResult.error);
    setProxyServiceMessage(configResult.error);
    return;
  }
  // Autostart changes follow the save action to keep behavior consistent.
  const autoStartResult = await applyAutoStartChange({
    enabled: autoStartEnabled,
    baseline: autoStartBaseline,
    status: autoStartStatus,
    setAutoStartBaseline,
    setAutoStartStatus,
    setAutoStartMessage,
  });
  if (autoStartResult.error) {
    setStatus("error");
    setStatusMessage(autoStartResult.error);
    return;
  }

  if (configResult.saved || autoStartResult.changed) {
    setStatus("saved");
    setStatusMessage("");
  } else {
    setStatus("idle");
    setStatusMessage("");
  }
}

type LoadConfigActionArgs = Pick<
  ConfigActionsArgs,
  | "setForm"
  | "setLastConfig"
  | "setConfigExtras"
  | "setStatus"
  | "setStatusMessage"
  | "setAutoStartEnabled"
  | "setAutoStartBaseline"
  | "setAutoStartStatus"
  | "setAutoStartMessage"
>;

function useLoadConfigAction({
  setForm,
  setLastConfig,
  setConfigExtras,
  setStatus,
  setStatusMessage,
  setAutoStartEnabled,
  setAutoStartBaseline,
  setAutoStartStatus,
  setAutoStartMessage,
}: LoadConfigActionArgs) {
  return useCallback(
    () =>
      Promise.all([
        loadConfigImpl({
          setForm,
          setLastConfig,
          setConfigExtras,
          setStatus,
          setStatusMessage,
        }),
        loadAutoStartImpl({
          setAutoStartEnabled,
          setAutoStartBaseline,
          setAutoStartStatus,
          setAutoStartMessage,
        }),
      ]).then(() => undefined),
    [
      setForm,
      setLastConfig,
      setConfigExtras,
      setStatus,
      setStatusMessage,
      setAutoStartEnabled,
      setAutoStartBaseline,
      setAutoStartStatus,
      setAutoStartMessage,
    ],
  );
}

type SaveConfigActionArgs = Pick<
  ConfigActionsArgs,
  | "currentPayload"
  | "validation"
  | "configDirty"
  | "autoStartEnabled"
  | "autoStartBaseline"
  | "autoStartStatus"
  | "setLastConfig"
  | "setStatus"
  | "setStatusMessage"
  | "setAutoStartBaseline"
  | "setAutoStartStatus"
  | "setAutoStartMessage"
  | "setProxyServiceStatus"
  | "setProxyServiceMessage"
>;

function useSaveConfigAction({
  currentPayload,
  validation,
  configDirty,
  autoStartEnabled,
  autoStartBaseline,
  autoStartStatus,
  setLastConfig,
  setStatus,
  setStatusMessage,
  setAutoStartBaseline,
  setAutoStartStatus,
  setAutoStartMessage,
  setProxyServiceStatus,
  setProxyServiceMessage,
}: SaveConfigActionArgs) {
  return useCallback(
    () =>
      saveConfigImpl({
        currentPayload,
        validation,
        configDirty,
        autoStartEnabled,
        autoStartBaseline,
        autoStartStatus,
        setLastConfig,
        setStatus,
        setStatusMessage,
        setAutoStartBaseline,
        setAutoStartStatus,
        setAutoStartMessage,
        setProxyServiceStatus,
        setProxyServiceMessage,
      }),
    [
      currentPayload,
      validation,
      configDirty,
      autoStartEnabled,
      autoStartBaseline,
      autoStartStatus,
      setLastConfig,
      setStatus,
      setStatusMessage,
      setAutoStartBaseline,
      setAutoStartStatus,
      setAutoStartMessage,
      setProxyServiceStatus,
      setProxyServiceMessage,
    ],
  );
}

export function useConfigActions(args: ConfigActionsArgs) {
  const loadConfig = useLoadConfigAction(args);
  const saveConfig = useSaveConfigAction(args);
  return { loadConfig, saveConfig };
}
