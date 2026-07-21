export type CodexAccountStatus = "active" | "disabled" | "expired" | "invalid";

export type CodexAccountSummary = {
  account_id: string;
  email?: string | null;
  expires_at?: string | null;
  status: CodexAccountStatus;
  auto_refresh_enabled?: boolean;
  proxy_url?: string | null;
  priority: number;
};
