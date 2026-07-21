export type XaiAccountStatus = "active" | "disabled" | "expired" | "invalid";

export type XaiAccountSummary = {
  account_id: string;
  email?: string | null;
  expires_at?: string | null;
  status: XaiAccountStatus;
  auto_refresh_enabled: boolean;
  proxy_url?: string | null;
  priority: number;
};

export type XaiLoginStatus = "waiting" | "success" | "error";

export type XaiLoginStartResponse = {
  state: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string | null;
  interval_seconds: number;
  expires_at?: string | null;
};

export type XaiLoginPollResponse = {
  state: string;
  status: XaiLoginStatus;
  error?: string | null;
  account: XaiAccountSummary | null;
};

export type XaiQuotaItem = {
  name: string;
  percentage: number;
  used: number | null;
  limit: number | null;
  reset_at: string | null;
};

export type XaiQuotaSummary = {
  account_id: string;
  plan_type: string | null;
  quotas: XaiQuotaItem[];
  error: string | null;
};
