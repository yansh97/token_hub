import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Switch } from "@/components/ui/switch";
import {
  ProxyServicePanel,
  type ProxyServiceViewProps,
} from "@/features/config/cards/proxy-service-card";
import type { ConfigForm } from "@/features/config/types";
import { m } from "@/paraglide/messages.js";

type ProxyCoreCardProps = {
  form: ConfigForm;
  showLocalKey: boolean;
  onToggleLocalKey: () => void;
  onChange: (patch: Partial<ConfigForm>) => void;
  proxyService: ProxyServiceViewProps;
};

type ProxyCoreFieldsProps = Pick<
  ProxyCoreCardProps,
  "form" | "showLocalKey" | "onToggleLocalKey" | "onChange"
>;

function ProxyCoreFields({
  form,
  showLocalKey,
  onToggleLocalKey,
  onChange,
}: ProxyCoreFieldsProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="proxy-host">{m.proxy_core_host_label()}</Label>
          <Input
            id="proxy-host"
            value={form.host}
            onChange={(event) => onChange({ host: event.target.value })}
            placeholder="127.0.0.1"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="proxy-port">{m.proxy_core_port_label()}</Label>
          <Input
            id="proxy-port"
            value={form.port}
            onChange={(event) => onChange({ port: event.target.value })}
            placeholder="9208"
            inputMode="numeric"
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="proxy-key">{m.proxy_core_local_api_key_label()}</Label>
        <PasswordInput
          id="proxy-key"
          visible={showLocalKey}
          onVisibilityChange={onToggleLocalKey}
          value={form.localApiKey}
          onChange={(event) => onChange({ localApiKey: event.target.value })}
          placeholder={m.common_optional()}
        />
        <p className="text-xs text-muted-foreground">
          {m.proxy_core_local_api_key_help()}
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="retryable-failure-cooldown-secs">
          {m.proxy_core_retryable_failure_cooldown_secs_label()}
        </Label>
        <Input
          id="retryable-failure-cooldown-secs"
          value={form.retryableFailureCooldownSecs}
          onChange={(event) =>
            onChange({ retryableFailureCooldownSecs: event.target.value })
          }
          placeholder="15"
          inputMode="numeric"
        />
        <p className="text-xs text-muted-foreground">
          {m.proxy_core_retryable_failure_cooldown_secs_help()}
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="same-upstream-retry-count">
          {m.proxy_core_same_upstream_retry_count_label()}
        </Label>
        <Input
          id="same-upstream-retry-count"
          value={form.sameUpstreamRetryCount}
          onChange={(event) =>
            onChange({ sameUpstreamRetryCount: event.target.value })
          }
          placeholder="1"
          inputMode="numeric"
        />
        <p className="text-xs text-muted-foreground">
          {m.proxy_core_same_upstream_retry_count_help()}
        </p>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="codex-session-scoped-cooldown">
            {m.proxy_core_codex_session_scoped_cooldown_label()}
          </Label>
          <p className="text-xs text-muted-foreground">
            {m.proxy_core_codex_session_scoped_cooldown_help()}
          </p>
        </div>
        <Switch
          id="codex-session-scoped-cooldown"
          checked={form.codexSessionScopedCooldownEnabled}
          onCheckedChange={(checked) =>
            onChange({ codexSessionScopedCooldownEnabled: checked })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="stream-first-output-timeout-secs">
          {m.proxy_core_stream_first_output_timeout_secs_label()}
        </Label>
        <Input
          id="stream-first-output-timeout-secs"
          value={form.streamFirstOutputTimeoutSecs}
          onChange={(event) =>
            onChange({ streamFirstOutputTimeoutSecs: event.target.value })
          }
          placeholder="60"
          inputMode="numeric"
        />
        <p className="text-xs text-muted-foreground">
          {m.proxy_core_stream_first_output_timeout_secs_help()}
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sync-response-timeout-secs">
          {m.proxy_core_sync_response_timeout_secs_label()}
        </Label>
        <Input
          id="sync-response-timeout-secs"
          value={form.syncResponseTimeoutSecs}
          onChange={(event) =>
            onChange({ syncResponseTimeoutSecs: event.target.value })
          }
          placeholder="300"
          inputMode="numeric"
        />
        <p className="text-xs text-muted-foreground">
          {m.proxy_core_sync_response_timeout_secs_help()}
        </p>
      </div>
    </>
  );
}

type ProxyCoreServiceSectionProps = {
  proxyService: ProxyServiceViewProps;
};

function ProxyCoreServiceSection({
  proxyService,
}: ProxyCoreServiceSectionProps) {
  return (
    <div className="pt-1">
      <ProxyServicePanel {...proxyService} />
    </div>
  );
}

export function ProxyCoreCard({
  form,
  showLocalKey,
  onToggleLocalKey,
  onChange,
  proxyService,
}: ProxyCoreCardProps) {
  return (
    <Card data-slot="proxy-core-card">
      <CardHeader>
        <CardTitle>{m.proxy_core_title()}</CardTitle>
        <CardDescription>{m.proxy_core_desc()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ProxyCoreFields
          form={form}
          showLocalKey={showLocalKey}
          onToggleLocalKey={onToggleLocalKey}
          onChange={onChange}
        />
        <ProxyCoreServiceSection proxyService={proxyService} />
      </CardContent>
    </Card>
  );
}
