import { act, renderHook } from "@testing-library/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useXaiLogin } from "@/features/xai/use-xai-login";
import type {
  XaiAccountSummary,
  XaiLoginPollResponse,
  XaiLoginStartResponse,
} from "@/features/xai/types";

const apiMocks = vi.hoisted(() => {
  const startXaiLogin = vi.fn<() => Promise<XaiLoginStartResponse>>();
  const pollXaiLogin = vi.fn<(state: string) => Promise<XaiLoginPollResponse>>();
  const cancelXaiLogin = vi.fn<(state: string) => Promise<void>>(async () => undefined);
  const toastSuccess = vi.fn<(message: string) => void>();

  return { startXaiLogin, pollXaiLogin, cancelXaiLogin, toastSuccess };
});

vi.mock("@/features/xai/api", () => ({
  startXaiLogin: apiMocks.startXaiLogin,
  pollXaiLogin: apiMocks.pollXaiLogin,
  cancelXaiLogin: apiMocks.cancelXaiLogin,
}));

vi.mock("sonner", () => ({
  toast: {
    success: apiMocks.toastSuccess,
  },
}));

const LOGIN_START: XaiLoginStartResponse = {
  state: "xai-login-state",
  user_code: "ABCD-EFGH",
  verification_uri: "https://auth.x.ai/device",
  verification_uri_complete: "https://auth.x.ai/device?user_code=ABCD-EFGH",
  interval_seconds: 2,
};

const LOGIN_ACCOUNT: XaiAccountSummary = {
  account_id: "xai-user@example.com",
  email: "user@example.com",
  expires_at: "2027-01-01T00:00:00Z",
  status: "active",
  auto_refresh_enabled: true,
  proxy_url: null,
  priority: 0,
};

const LOGIN_SUCCESS: XaiLoginPollResponse = {
  state: LOGIN_START.state,
  status: "success",
  account: LOGIN_ACCOUNT,
};

describe("xai/use-xai-login", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("opens the complete device verification URL and polls after the requested interval", async () => {
    vi.useFakeTimers();
    apiMocks.startXaiLogin.mockResolvedValueOnce(LOGIN_START);
    apiMocks.pollXaiLogin.mockResolvedValue({
      state: LOGIN_START.state,
      status: "waiting",
      account: null,
    });
    const onRefresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { result } = renderHook(() => useXaiLogin({ onRefresh }));

    await act(async () => {
      await result.current.beginLogin();
    });

    expect(openUrl).toHaveBeenCalledWith(LOGIN_START.verification_uri_complete);
    expect(result.current.login.start).toEqual(LOGIN_START);
    await act(async () => {
      vi.advanceTimersByTime(LOGIN_START.interval_seconds * 1000);
      await Promise.resolve();
    });
    expect(apiMocks.pollXaiLogin).toHaveBeenCalledWith(LOGIN_START.state);
    expect(result.current.login.status).toBe("polling");
  });

  it("ignores a late device-code response after reset", async () => {
    let resolveStart: ((response: XaiLoginStartResponse) => void) | undefined;
    apiMocks.startXaiLogin.mockReturnValueOnce(
      new Promise<XaiLoginStartResponse>((resolve) => {
        resolveStart = resolve;
      }),
    );
    const onRefresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { result } = renderHook(() => useXaiLogin({ onRefresh }));

    act(() => {
      void result.current.beginLogin();
    });
    act(() => {
      result.current.resetLogin();
    });
    await act(async () => {
      if (!resolveStart) {
        throw new Error("Missing xai login start resolver");
      }
      resolveStart(LOGIN_START);
      await Promise.resolve();
    });

    expect(result.current.login.status).toBe("idle");
    expect(openUrl).not.toHaveBeenCalled();
    expect(apiMocks.pollXaiLogin).not.toHaveBeenCalled();
    expect(apiMocks.cancelXaiLogin).toHaveBeenCalledWith(LOGIN_START.state);
  });

  it("ignores an in-flight poll response after reset", async () => {
    vi.useFakeTimers();
    let resolvePoll: ((response: XaiLoginPollResponse) => void) | undefined;
    apiMocks.startXaiLogin.mockResolvedValueOnce(LOGIN_START);
    apiMocks.pollXaiLogin.mockReturnValueOnce(
      new Promise<XaiLoginPollResponse>((resolve) => {
        resolvePoll = resolve;
      }),
    );
    const onRefresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { result } = renderHook(() => useXaiLogin({ onRefresh }));

    await act(async () => {
      await result.current.beginLogin();
    });
    await act(async () => {
      vi.advanceTimersByTime(LOGIN_START.interval_seconds * 1000);
      await Promise.resolve();
    });
    act(() => {
      result.current.resetLogin();
    });
    await act(async () => {
      if (!resolvePoll) {
        throw new Error("Missing xai login poll resolver");
      }
      resolvePoll(LOGIN_SUCCESS);
      await Promise.resolve();
    });

    expect(result.current.login.status).toBe("idle");
    expect(onRefresh).not.toHaveBeenCalled();
    expect(apiMocks.toastSuccess).not.toHaveBeenCalled();
    expect(apiMocks.cancelXaiLogin).toHaveBeenCalledWith(LOGIN_START.state);
  });

  it("cancels the active backend login when the hook unmounts", async () => {
    apiMocks.startXaiLogin.mockResolvedValueOnce(LOGIN_START);
    const onRefresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useXaiLogin({ onRefresh }));

    await act(async () => {
      await result.current.beginLogin();
    });
    unmount();

    expect(apiMocks.cancelXaiLogin).toHaveBeenCalledOnce();
    expect(apiMocks.cancelXaiLogin).toHaveBeenCalledWith(LOGIN_START.state);
  });

  it("cancels the previous backend login before starting a replacement", async () => {
    const replacement = { ...LOGIN_START, state: "replacement-login-state" };
    apiMocks.startXaiLogin
      .mockResolvedValueOnce(LOGIN_START)
      .mockResolvedValueOnce(replacement);
    const onRefresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { result } = renderHook(() => useXaiLogin({ onRefresh }));

    await act(async () => {
      await result.current.beginLogin();
      await result.current.beginLogin();
    });

    expect(apiMocks.cancelXaiLogin).toHaveBeenCalledOnce();
    expect(apiMocks.cancelXaiLogin).toHaveBeenCalledWith(LOGIN_START.state);
    expect(result.current.login.start).toEqual(replacement);
  });

  it("refreshes and selects the account exactly once after device login succeeds", async () => {
    vi.useFakeTimers();
    apiMocks.startXaiLogin.mockResolvedValueOnce(LOGIN_START);
    apiMocks.pollXaiLogin.mockResolvedValueOnce(LOGIN_SUCCESS);
    const onRefresh = vi.fn<(accountId?: string) => Promise<void>>().mockResolvedValue(undefined);
    const onSelect = vi.fn<(accountId: string) => void>();
    const { result } = renderHook(() => useXaiLogin({ onRefresh, onSelect }));

    await act(async () => {
      await result.current.beginLogin();
    });
    await act(async () => {
      vi.advanceTimersByTime(LOGIN_START.interval_seconds * 1000);
      await Promise.resolve();
    });

    expect(result.current.login.status).toBe("success");
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onRefresh).toHaveBeenCalledWith(LOGIN_ACCOUNT.account_id);
    expect(onSelect).toHaveBeenCalledWith(LOGIN_ACCOUNT.account_id);
    expect(apiMocks.toastSuccess).toHaveBeenCalledOnce();
    expect(apiMocks.cancelXaiLogin).not.toHaveBeenCalled();
  });
});
