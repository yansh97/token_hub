import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSectionRoute } from "@/features/config/sections";
import type { XaiAccountSummary } from "@/features/xai/types";
import { m } from "@/paraglide/messages.js";

const AUTOMATIC_ACCOUNT_VALUE = "__automatic_xai_account__";

type XaiAccountSelectProps = {
  accountId: string;
  accounts: XaiAccountSummary[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onSelect: (accountId: string) => void;
};

function formatAccountLabel(account: XaiAccountSummary) {
  return account.email?.trim() || account.account_id;
}

function formatAccountStatus(account: XaiAccountSummary) {
  if (account.status === "expired") {
    return m.xai_account_status_expired();
  }
  if (account.status === "invalid") {
    return m.xai_account_status_invalid();
  }
  if (account.status === "disabled") {
    return m.xai_account_status_disabled();
  }
  return m.xai_account_status_active();
}

export function XaiAccountSelect({
  accountId,
  accounts,
  loading,
  error,
  onRefresh,
  onSelect,
}: XaiAccountSelectProps) {
  const value = accountId.trim() || AUTOMATIC_ACCOUNT_VALUE;

  return (
    <div data-slot="xai-account-select" className="contents">
      <Label htmlFor="upstream-editor-xai-account">{m.field_xai_account()}</Label>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Select
            value={value}
            onValueChange={(nextValue) =>
              onSelect(nextValue === AUTOMATIC_ACCOUNT_VALUE ? "" : nextValue)
            }
          >
            <SelectTrigger id="upstream-editor-xai-account" className="flex-1">
              <SelectValue placeholder={m.xai_account_placeholder()} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTOMATIC_ACCOUNT_VALUE}>{m.xai_account_auto()}</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.account_id} value={account.account_id}>
                  {formatAccountLabel(account)} · {formatAccountStatus(account)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onRefresh}
            disabled={loading}
            aria-label={m.common_refresh()}
          >
            <RefreshCw
              className={["size-4", loading ? "animate-spin" : ""].filter(Boolean).join(" ")}
              aria-hidden="true"
            />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link className="text-primary hover:underline" to={getSectionRoute("providers")}>
            {m.xai_account_manage()}
          </Link>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
