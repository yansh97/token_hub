import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCodexAccounts } from "@/features/codex/use-codex-accounts";

const listCodexAccounts = vi.hoisted(() => vi.fn());

vi.mock("@/features/codex/api", () => ({ listCodexAccounts }));

describe("codex/use-codex-accounts", () => {
  afterEach(() => vi.clearAllMocks());

  it("autoLoad=false 时挂载不主动拉账户", async () => {
    renderHook(() => useCodexAccounts({ autoLoad: false }));
    await waitFor(() => expect(listCodexAccounts).not.toHaveBeenCalled());
  });

  it("自动加载账户并暴露加载状态", async () => {
    listCodexAccounts.mockResolvedValue([
      {
        account_id: "codex-1",
        email: "bob@example.com",
        expires_at: null,
        status: "active",
        priority: 0,
      },
    ]);

    const { result } = renderHook(() => useCodexAccounts());
    await waitFor(() => expect(result.current.accounts).toHaveLength(1));
    expect(result.current.loading).toBe(false);
  });
});
