export type KiroAccountStatus = "active" | "disabled" | "expired";

export type KiroAccountSummary = {
  account_id: string;
  provider: string;
  auth_method: string;
  email: string | null;
  expires_at: string | null;
  status: KiroAccountStatus;
  proxy_url?: string | null;
  priority: number;
};
