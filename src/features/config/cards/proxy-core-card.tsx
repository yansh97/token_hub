import type { ReactNode } from "react";

import { FieldError, FieldRequirement } from "@/components/ui/field-meta";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  ProxyServicePanel,
  type ProxyServiceViewProps,
} from "@/features/config/cards/proxy-service-card";
import type { ConfigForm } from "@/features/config/types";
import { validateSettingsFields } from "@/features/config/form";
import { cn } from "@/lib/utils";

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
  required: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
};

function CoreField({
  label,
  htmlFor,
  help,
  required,
  error,
  className,
  children,
}: CoreFieldProps) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="gap-1.5 text-[13px] leading-5">
        <span>{label}</span>
        <FieldRequirement required={required} />
      </Label>
      {children}
      {help ? (
        <p
          id={htmlFor ? `${htmlFor}-help` : undefined}
          className="text-[11px] leading-4 text-muted-foreground"
        >
          {help}
        </p>
      ) : null}
      <FieldError id={htmlFor ? `${htmlFor}-error` : undefined} message={error} />
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
  const errors = validateSettingsFields(form);
  if (section === "connection") {
    return (
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <CoreField
          label="监听地址"
          htmlFor="proxy-host"
          required
          error={errors.host}
        >
          <Input
            id="proxy-host"
            required
            aria-invalid={Boolean(errors.host)}
            aria-describedby={errors.host ? "proxy-host-error" : undefined}
            value={form.host}
            onChange={(event) => onChange({ host: event.target.value })}
            placeholder="127.0.0.1"
          />
        </CoreField>
        <CoreField
          label="端口"
          htmlFor="proxy-port"
          required
          error={errors.port}
        >
          <Input
            id="proxy-port"
            required
            aria-invalid={Boolean(errors.port)}
            aria-describedby={errors.port ? "proxy-port-error" : undefined}
            value={form.port}
            onChange={(event) => onChange({ port: event.target.value })}
            placeholder="9208"
            inputMode="numeric"
          />
        </CoreField>
        <CoreField
          label="API Key"
          htmlFor="proxy-key"
          help="留空时不启用本地鉴权。"
          required={false}
          className="sm:col-span-2"
        >
          <PasswordInput
            id="proxy-key"
            visible={showLocalKey}
            onVisibilityChange={onToggleLocalKey}
            value={form.localApiKey}
            onChange={(event) => onChange({ localApiKey: event.target.value })}
            aria-describedby="proxy-key-help"
            placeholder="token-hub-key"
          />
        </CoreField>
      </div>
    );
  }

  return (
    <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
      <CoreField
        label="失败冷却时间（秒）"
        htmlFor="retryable-failure-cooldown-secs"
        help="默认 15；遇到 401、403、408、429 或 5xx 后暂停提供商，填 0 关闭。"
        required
        error={errors.retryableFailureCooldownSecs}
      >
        <Input
          id="retryable-failure-cooldown-secs"
          required
          aria-invalid={Boolean(errors.retryableFailureCooldownSecs)}
          aria-describedby={`retryable-failure-cooldown-secs-help${
            errors.retryableFailureCooldownSecs
              ? " retryable-failure-cooldown-secs-error"
              : ""
          }`}
          value={form.retryableFailureCooldownSecs}
          onChange={(event) =>
            onChange({ retryableFailureCooldownSecs: event.target.value })
          }
          placeholder="15"
          inputMode="numeric"
        />
      </CoreField>
      <CoreField
        label="同一提供商重试次数"
        htmlFor="same-upstream-retry-count"
        help="默认 1，最大 5。"
        required
        error={errors.sameUpstreamRetryCount}
      >
        <Input
          id="same-upstream-retry-count"
          required
          aria-invalid={Boolean(errors.sameUpstreamRetryCount)}
          aria-describedby={`same-upstream-retry-count-help${
            errors.sameUpstreamRetryCount
              ? " same-upstream-retry-count-error"
              : ""
          }`}
          value={form.sameUpstreamRetryCount}
          onChange={(event) =>
            onChange({ sameUpstreamRetryCount: event.target.value })
          }
          placeholder="1"
          inputMode="numeric"
        />
      </CoreField>
      <CoreField
        label="流式首个输出超时（秒）"
        htmlFor="stream-first-output-timeout-secs"
        help="等待首个可见流式输出的上限，默认 60。"
        required
        error={errors.streamFirstOutputTimeoutSecs}
      >
        <Input
          id="stream-first-output-timeout-secs"
          required
          aria-invalid={Boolean(errors.streamFirstOutputTimeoutSecs)}
          aria-describedby={`stream-first-output-timeout-secs-help${
            errors.streamFirstOutputTimeoutSecs
              ? " stream-first-output-timeout-secs-error"
              : ""
          }`}
          value={form.streamFirstOutputTimeoutSecs}
          onChange={(event) =>
            onChange({ streamFirstOutputTimeoutSecs: event.target.value })
          }
          placeholder="60"
          inputMode="numeric"
        />
      </CoreField>
      <CoreField
        label="同步响应超时（秒）"
        htmlFor="sync-response-timeout-secs"
        help="读取完整非流式响应的总时限，默认 300。"
        required
        error={errors.syncResponseTimeoutSecs}
      >
        <Input
          id="sync-response-timeout-secs"
          required
          aria-invalid={Boolean(errors.syncResponseTimeoutSecs)}
          aria-describedby={`sync-response-timeout-secs-help${
            errors.syncResponseTimeoutSecs
              ? " sync-response-timeout-secs-error"
              : ""
          }`}
          value={form.syncResponseTimeoutSecs}
          onChange={(event) =>
            onChange({ syncResponseTimeoutSecs: event.target.value })
          }
          placeholder="300"
          inputMode="numeric"
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
    <div
      data-slot="proxy-core-card"
      className="space-y-0"
    >
        <CoreSection title="连接" separated={false}>
          <ProxyCoreFields
            form={form}
            showLocalKey={showLocalKey}
            onToggleLocalKey={onToggleLocalKey}
            onChange={onChange}
            section="connection"
          />
        </CoreSection>
        <CoreSection title="高级设置">
          <ProxyCoreFields
            form={form}
            showLocalKey={showLocalKey}
            onToggleLocalKey={onToggleLocalKey}
            onChange={onChange}
            section="advanced"
          />
        </CoreSection>
        <ProxyCoreServiceSection proxyService={proxyService} />
    </div>
  );
}
