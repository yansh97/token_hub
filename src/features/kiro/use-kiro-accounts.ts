import { useCallback, useEffect, useState } from "react";

import { listKiroAccounts } from "@/features/kiro/api";
import type { KiroAccountSummary } from "@/features/kiro/types";

type UseKiroAccountsOptions = {
  autoLoad?: boolean;
};

export function useKiroAccounts(options?: UseKiroAccountsOptions) {
  const autoLoad = options?.autoLoad ?? true;
  const [accounts, setAccounts] = useState<KiroAccountSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await listKiroAccounts());
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
