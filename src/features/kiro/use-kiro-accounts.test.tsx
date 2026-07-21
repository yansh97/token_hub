import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useKiroAccounts } from "@/features/kiro/use-kiro-accounts";

const listKiroAccounts = vi.hoisted(() => vi.fn());

vi.mock("@/features/kiro/api", () => ({ listKiroAccounts }));

describe("kiro/use-kiro-accounts", () => {
  afterEach(() => vi.clearAllMocks());

  it("autoLoad=false 时挂载不主动拉账户", async () => {
    renderHook(() => useKiroAccounts({ autoLoad: false }));
    await waitFor(() => expect(listKiroAccounts).not.toHaveBeenCalled());
  });

  it("自动加载账户并暴露加载状态", async () => {
    listKiroAccounts.mockResolvedValue([
      {
        account_id: "kiro-1",
        provider: "kiro",
        auth_method: "google",
        email: "alice@example.com",
        expires_at: null,
        status: "active",
        priority: 0,
      },
    ]);

    const { result } = renderHook(() => useKiroAccounts());
    await waitFor(() => expect(result.current.accounts).toHaveLength(1));
    expect(result.current.loading).toBe(false);
  });
});
