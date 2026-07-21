import { useCallback, useEffect, useState } from "react";

import { listCodexAccounts } from "@/features/codex/api";
import type { CodexAccountSummary } from "@/features/codex/types";

type UseCodexAccountsOptions = {
  autoLoad?: boolean;
};

export function useCodexAccounts(options?: UseCodexAccountsOptions) {
  const autoLoad = options?.autoLoad ?? true;
  const [accounts, setAccounts] = useState<CodexAccountSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await listCodexAccounts());
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) void refresh();
  }, [autoLoad, refresh]);

  return { accounts, loading };
}
