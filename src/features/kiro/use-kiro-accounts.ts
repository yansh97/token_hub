import { useEffect, useState } from "react";

import { listKiroAccounts } from "@/features/kiro/api";
import type { KiroAccountSummary } from "@/features/kiro/types";

type UseKiroAccountsOptions = {
  autoLoad?: boolean;
};

export function useKiroAccounts(options?: UseKiroAccountsOptions) {
  const autoLoad = options?.autoLoad ?? true;
  const [accounts, setAccounts] = useState<KiroAccountSummary[]>([]);
  const [loading, setLoading] = useState(autoLoad);

  useEffect(() => {
    if (!autoLoad) {
      return;
    }
    let active = true;
    void listKiroAccounts().then(
      (nextAccounts) => {
        if (!active) return;
        setAccounts(nextAccounts);
        setLoading(false);
      },
      () => {
        if (!active) return;
        setAccounts([]);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [autoLoad]);

  return { accounts, loading };
}
