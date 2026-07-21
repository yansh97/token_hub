import { useCallback, useState } from "react";

import { fetchXaiQuotas } from "@/features/xai/api";
import type { XaiQuotaSummary } from "@/features/xai/types";
import { parseError } from "@/lib/error";

export function useXaiQuotas() {
  const [quotas, setQuotas] = useState<XaiQuotaSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setQuotas(await fetchXaiQuotas());
      setError("");
    } catch (cause) {
      setError(parseError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  return { quotas, loading, error, refresh };
}
