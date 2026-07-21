import { useCallback, useEffect, useRef, useState } from "react";

import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { cancelXaiLogin, pollXaiLogin, startXaiLogin } from "@/features/xai/api";
import type { XaiLoginStartResponse } from "@/features/xai/types";
import { parseError } from "@/lib/error";
import { m } from "@/paraglide/messages.js";

export type XaiLoginState = {
  status: "idle" | "waiting" | "polling" | "success" | "error";
  start?: XaiLoginStartResponse;
  error?: string;
};

type XaiLoginPollingHandlers = {
  onSuccess: (accountId?: string) => Promise<void>;
  onError: (message: string) => void;
  onPending: () => boolean;
  onException: (error: unknown) => void;
};

type UseXaiLoginOptions = {
  onRefresh: (accountId?: string) => Promise<void> | void;
  onSelect?: (accountId: string) => void;
};

function normalizeIntervalSeconds(intervalSeconds: number | null | undefined) {
  if (typeof intervalSeconds !== "number" || !Number.isFinite(intervalSeconds)) {
    return 5;
  }
  return Math.max(1, intervalSeconds);
}

function startLoginPolling(
  state: string,
  intervalSeconds: number,
  handlers: XaiLoginPollingHandlers,
) {
  let timerId: number | null = null;
  let stopped = false;
  const delayMs = intervalSeconds * 1000;

  const scheduleNext = () => {
    if (!stopped) {
      timerId = window.setTimeout(runPoll, delayMs);
    }
  };

  const runPoll = async () => {
    timerId = null;
    if (stopped) {
      return;
    }
    try {
      const result = await pollXaiLogin(state);
      if (stopped) {
        return;
      }
      if (result.status === "success") {
        await handlers.onSuccess(result.account?.account_id ?? undefined);
        return;
      }
      if (result.status === "error") {
        handlers.onError(result.error ?? m.xai_login_failed());
        return;
      }
      if (handlers.onPending()) {
        scheduleNext();
      }
    } catch (error) {
      handlers.onException(error);
    }
  };

  scheduleNext();
  return () => {
    stopped = true;
    if (timerId !== null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
  };
}

export function useXaiLogin({ onRefresh, onSelect }: UseXaiLoginOptions) {
  const [login, setLogin] = useState<XaiLoginState>({ status: "idle" });
  const stopPolling = useRef<(() => void) | null>(null);
  const loginRunSeq = useRef(0);
  const activeLoginState = useRef<string | null>(null);

  const clearPoller = useCallback(() => {
    stopPolling.current?.();
    stopPolling.current = null;
  }, []);

  const cancelBackendLogin = useCallback((state: string) => {
    void cancelXaiLogin(state).catch((error) => {
      console.warn("[xai-login] failed to cancel device authorization", {
        error: parseError(error),
      });
    });
  }, []);

  const cancelLoginRun = useCallback(() => {
    loginRunSeq.current += 1;
    clearPoller();
    const state = activeLoginState.current;
    activeLoginState.current = null;
    if (state) {
      console.debug("[xai-login] cancel active device authorization");
      cancelBackendLogin(state);
    }
  }, [cancelBackendLogin, clearPoller]);

  const isCurrentLoginRun = useCallback((loginRun: number) => loginRunSeq.current === loginRun, []);

  const resetLogin = useCallback(() => {
    // 关闭添加账户弹窗后废弃旧轮次，防止晚到的 device-code 结果恢复旧状态。
    cancelLoginRun();
    console.debug("[xai-login] reset device authorization state");
    setLogin({ status: "idle" });
  }, [cancelLoginRun]);

  const startPolling = useCallback(
    (state: string, intervalSeconds: number, loginRun: number) => {
      clearPoller();
      stopPolling.current = startLoginPolling(state, intervalSeconds, {
        onSuccess: async (accountId) => {
          if (!isCurrentLoginRun(loginRun)) {
            return;
          }
          clearPoller();
          activeLoginState.current = null;
          setLogin({ status: "success" });
          await Promise.resolve(onRefresh(accountId));
          if (!isCurrentLoginRun(loginRun)) {
            return;
          }
          toast.success(m.xai_login_success());
          if (accountId && onSelect) {
            onSelect(accountId);
          }
        },
        onError: (message) => {
          if (!isCurrentLoginRun(loginRun)) {
            return;
          }
          clearPoller();
          activeLoginState.current = null;
          setLogin({ status: "error", error: message });
        },
        onPending: () => {
          if (!isCurrentLoginRun(loginRun)) {
            return false;
          }
          setLogin((current) => ({ ...current, status: "polling", error: "" }));
          return true;
        },
        onException: (error) => {
          if (!isCurrentLoginRun(loginRun)) {
            return;
          }
          clearPoller();
          activeLoginState.current = null;
          cancelBackendLogin(state);
          setLogin({ status: "error", error: parseError(error) });
        },
      });
    },
    [cancelBackendLogin, clearPoller, isCurrentLoginRun, onRefresh, onSelect],
  );

  const beginLogin = useCallback(async () => {
    cancelLoginRun();
    const loginRun = loginRunSeq.current;
    setLogin({ status: "waiting" });
    try {
      const start = await startXaiLogin();
      if (!isCurrentLoginRun(loginRun)) {
        // start command 已创建后台任务；旧轮次即使不再更新 UI，也必须主动终止。
        cancelBackendLogin(start.state);
        return;
      }
      activeLoginState.current = start.state;
      setLogin({ status: "waiting", start });
      const loginUrl = start.verification_uri_complete?.trim() || start.verification_uri.trim();
      if (loginUrl) {
        void openUrl(loginUrl);
      }
      startPolling(start.state, normalizeIntervalSeconds(start.interval_seconds), loginRun);
    } catch (error) {
      if (isCurrentLoginRun(loginRun)) {
        setLogin({ status: "error", error: parseError(error) });
      }
    }
  }, [cancelBackendLogin, cancelLoginRun, isCurrentLoginRun, startPolling]);

  useEffect(() => () => cancelLoginRun(), [cancelLoginRun]);

  return { login, beginLogin, resetLogin };
}
