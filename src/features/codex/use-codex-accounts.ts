import { useEffect, useState } from "react";

import { listCodexAccounts } from "@/features/codex/api";
import type { CodexAccountSummary } from "@/features/codex/types";

type UseCodexAccountsOptions = {
  autoLoad?: boolean;
};

export function useCodexAccounts(options?: UseCodexAccountsOptions) {
  const autoLoad = options?.autoLoad ?? true;
  const [accounts, setAccounts] = useState<CodexAccountSummary[]>([]);
  const [loading, setLoading] = useState(autoLoad);

  useEffect(() => {
    if (!autoLoad) {
      return;
    }
    let active = true;
    void listCodexAccounts().then(
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
