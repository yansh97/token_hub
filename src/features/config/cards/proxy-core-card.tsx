import type { ReactNode } from "react";

import {
  Card,
  CardContent,
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
import { cn } from "@/lib/utils";
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
> & { section: "connection" | "advanced" };

type CoreFieldProps = {
  label: string;
  htmlFor?: string;
  help?: string;
  className?: string;
  children: ReactNode;
};

function CoreField({
  label,
  htmlFor,
  help,
  className,
  children,
}: CoreFieldProps) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[13px] leading-5">
        {label}
      </Label>
      {children}
      {help ? (
        <p className="text-[11px] leading-4 text-muted-foreground">{help}</p>
      ) : null}
    </div>
  );
}

type CoreSectionProps = {
  title: string;
  children: ReactNode;
  separated?: boolean;
};

function CoreSection({ title, children, separated = true }: CoreSectionProps) {
  return (
    <section
      className={separated ? "mt-5 border-t border-border/70 pt-5" : ""}
    >
      <h2 className="text-[15px] font-semibold leading-5">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProxyCoreFields({
  form,
  showLocalKey,
  onToggleLocalKey,
  onChange,
  section,
}: ProxyCoreFieldsProps) {
  if (section === "connection") {
    return (
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <CoreField label={m.proxy_core_host_label()} htmlFor="proxy-host">
          <Input
            id="proxy-host"
            value={form.host}
            onChange={(event) => onChange({ host: event.target.value })}
            placeholder="127.0.0.1"
            className="h-9 text-sm"
          />
        </CoreField>
        <CoreField label={m.proxy_core_port_label()} htmlFor="proxy-port">
          <Input
            id="proxy-port"
            value={form.port}
            onChange={(event) => onChange({ port: event.target.value })}
            placeholder="9208"
            inputMode="numeric"
            className="h-9 text-sm"
          />
        </CoreField>
        <CoreField
          label={m.proxy_core_local_api_key_label()}
          htmlFor="proxy-key"
          help={m.proxy_core_local_api_key_help()}
          className="sm:col-span-2"
        >
          <PasswordInput
            id="proxy-key"
            visible={showLocalKey}
            onVisibilityChange={onToggleLocalKey}
            value={form.localApiKey}
            onChange={(event) => onChange({ localApiKey: event.target.value })}
            placeholder={m.common_optional()}
            className="h-9 text-sm"
          />
        </CoreField>
      </div>
    );
  }

  return (
    <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
      <CoreField
        label={m.proxy_core_retryable_failure_cooldown_secs_label()}
        htmlFor="retryable-failure-cooldown-secs"
        help={m.proxy_core_retryable_failure_cooldown_secs_help()}
      >
        <Input
          id="retryable-failure-cooldown-secs"
          value={form.retryableFailureCooldownSecs}
          onChange={(event) =>
            onChange({ retryableFailureCooldownSecs: event.target.value })
          }
          placeholder="15"
          inputMode="numeric"
          className="h-9 text-sm"
        />
      </CoreField>
      <CoreField
        label={m.proxy_core_same_upstream_retry_count_label()}
        htmlFor="same-upstream-retry-count"
        help={m.proxy_core_same_upstream_retry_count_help()}
      >
        <Input
          id="same-upstream-retry-count"
          value={form.sameUpstreamRetryCount}
          onChange={(event) =>
            onChange({ sameUpstreamRetryCount: event.target.value })
          }
          placeholder="1"
          inputMode="numeric"
          className="h-9 text-sm"
        />
      </CoreField>
      <div className="flex items-center justify-between gap-4 py-1 sm:col-span-2">
        <div className="min-w-0 space-y-0.5">
          <Label
            htmlFor="codex-session-scoped-cooldown"
            className="text-[13px] leading-5"
          >
            {m.proxy_core_codex_session_scoped_cooldown_label()}
          </Label>
          <p className="text-[11px] leading-4 text-muted-foreground">
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
      <CoreField
        label={m.proxy_core_stream_first_output_timeout_secs_label()}
        htmlFor="stream-first-output-timeout-secs"
        help={m.proxy_core_stream_first_output_timeout_secs_help()}
      >
        <Input
          id="stream-first-output-timeout-secs"
          value={form.streamFirstOutputTimeoutSecs}
          onChange={(event) =>
            onChange({ streamFirstOutputTimeoutSecs: event.target.value })
          }
          placeholder="60"
          inputMode="numeric"
          className="h-9 text-sm"
        />
      </CoreField>
      <CoreField
        label={m.proxy_core_sync_response_timeout_secs_label()}
        htmlFor="sync-response-timeout-secs"
        help={m.proxy_core_sync_response_timeout_secs_help()}
      >
        <Input
          id="sync-response-timeout-secs"
          value={form.syncResponseTimeoutSecs}
          onChange={(event) =>
            onChange({ syncResponseTimeoutSecs: event.target.value })
          }
          placeholder="300"
          inputMode="numeric"
          className="h-9 text-sm"
        />
      </CoreField>
    </div>
  );
}

type ProxyCoreServiceSectionProps = {
  proxyService: ProxyServiceViewProps;
};

function ProxyCoreServiceSection({
  proxyService,
}: ProxyCoreServiceSectionProps) {
  return (
    <section className="mt-5 border-t border-border/70 pt-5">
      <ProxyServicePanel {...proxyService} />
    </section>
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
    <Card
      data-slot="proxy-core-card"
      className="gap-0 rounded-none border-0 bg-transparent py-0 shadow-none"
    >
      <CardContent className="space-y-0 px-0">
        <CoreSection title={m.proxy_core_connection_section()} separated={false}>
          <ProxyCoreFields
            form={form}
            showLocalKey={showLocalKey}
            onToggleLocalKey={onToggleLocalKey}
            onChange={onChange}
            section="connection"
          />
        </CoreSection>
        <CoreSection title={m.proxy_core_advanced_section()}>
          <ProxyCoreFields
            form={form}
            showLocalKey={showLocalKey}
            onToggleLocalKey={onToggleLocalKey}
            onChange={onChange}
            section="advanced"
          />
        </CoreSection>
        <ProxyCoreServiceSection proxyService={proxyService} />
      </CardContent>
    </Card>
  );
}
