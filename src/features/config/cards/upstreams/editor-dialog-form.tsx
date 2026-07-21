import { CirclePlus } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { FieldRequirement } from "@/components/ui/field-meta";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AvailableModelsEditor } from "@/features/config/cards/upstreams/available-models-editor";
import { ConvertFromMapEditor } from "@/features/config/cards/upstreams/convert-from-map-editor";
import {
  EditorField,
  HeaderOverridesEditor,
  ModelMappingsEditor,
} from "@/features/config/cards/upstreams/editor-fields";
import { ProviderMultiSelect } from "@/features/config/cards/upstreams/provider-multi-select";
import { isAccountBackedProviderSet } from "@/features/config/cards/upstreams/upstream-editor-helpers";
import { createModelMapping } from "@/features/config/form";
import type {
  HeaderOverrideForm,
  KiroPreferredEndpoint,
  UpstreamForm,
} from "@/features/config/types";

const KIRO_ENDPOINT_INHERIT = "inherit";

const KIRO_ENDPOINT_OPTIONS: ReadonlyArray<{
  value: KiroPreferredEndpoint | typeof KIRO_ENDPOINT_INHERIT;
  label: () => string;
}> = [
  {
    value: KIRO_ENDPOINT_INHERIT,
    label: () => "使用全局",
  },
  { value: "ide", label: () => "IDE（CodeWhisperer）" },
  { value: "cli", label: () => "CLI（Amazon Q）" },
];

function isKiroPreferredEndpoint(
  value: string,
): value is KiroPreferredEndpoint {
  return value === "ide" || value === "cli";
}

function isLockedAccountBackedUpstream(draft: UpstreamForm) {
  const providers = draft.providers
    .map((value) => value.trim())
    .filter(Boolean);
  return (
    providers.length === 1 &&
    ((providers[0] === "kiro" && draft.id.trim() === "kiro-default") ||
      (providers[0] === "codex" && draft.id.trim() === "codex-default"))
  );
}

export type UpstreamEditorFieldsProps = {
  draft: UpstreamForm;
  errors?: Readonly<Record<string, string>>;
  providerOptions: readonly string[];
  showApiKeys: boolean;
  onToggleApiKeys: () => void;
  onChangeDraft: (patch: Partial<UpstreamForm>) => void;
  onFieldBlur?: (field: string) => void;
};

type EditorSectionProps = {
  title: string;
  children: ReactNode;
};

function EditorSection({ title, children }: EditorSectionProps) {
  return (
    <section className="space-y-2.5 border-b pb-3.5 last:border-b-0 last:pb-0">
      <h3 className="text-[13px] font-semibold leading-5">{title}</h3>
      {children}
    </section>
  );
}

type UpstreamConnectionFieldsProps = {
  draft: UpstreamForm;
  errors: Readonly<Record<string, string>>;
  providerOptions: readonly string[];
  showApiKeys: boolean;
  onToggleApiKeys: () => void;
  onChangeDraft: (patch: Partial<UpstreamForm>) => void;
  onFieldBlur: (field: string) => void;
};

function UpstreamConnectionFields({
  draft,
  errors,
  providerOptions,
  showApiKeys,
  onToggleApiKeys,
  onChangeDraft,
  onFieldBlur,
}: UpstreamConnectionFieldsProps) {
  const providers = draft.providers
    .map((value) => value.trim())
    .filter(Boolean);
  const isAccountBackedProvider = isAccountBackedProviderSet(providers);
  const isKiro = providers.includes("kiro");
  const isLocked = isLockedAccountBackedUpstream(draft);
  const kiroEndpointValue = draft.preferredEndpoint.trim()
    ? draft.preferredEndpoint
    : KIRO_ENDPOINT_INHERIT;

  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5">
      <EditorField label={"接口格式"} required error={errors.providers}>
        <ProviderMultiSelect
          providerOptions={providerOptions}
          value={draft.providers}
          disabled={isLocked}
          error={errors.providers}
          onChange={(next) => onChangeDraft({ providers: next })}
        />
      </EditorField>

      {isKiro ? (
        <EditorField
          label={"Kiro 端点"}
          htmlFor="upstream-editor-kiro-endpoint"
          required={false}
        >
          <Select
            value={kiroEndpointValue}
            onValueChange={(value) => {
              if (value === KIRO_ENDPOINT_INHERIT) {
                onChangeDraft({ preferredEndpoint: "" });
                return;
              }
              if (isKiroPreferredEndpoint(value)) {
                onChangeDraft({ preferredEndpoint: value });
              }
            }}
          >
            <SelectTrigger id="upstream-editor-kiro-endpoint">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIRO_ENDPOINT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </EditorField>
      ) : null}

      {isAccountBackedProvider ? null : (
        <>
          <EditorField
            label={"Base URL"}
            htmlFor="upstream-editor-baseUrl"
            required
            error={errors.baseUrl}
          >
            <Input
              id="upstream-editor-baseUrl"
              required
              aria-invalid={Boolean(errors.baseUrl)}
              aria-describedby={
                errors.baseUrl ? "upstream-editor-baseUrl-error" : undefined
              }
              value={draft.baseUrl}
              onChange={(event) =>
                onChangeDraft({ baseUrl: event.target.value })
              }
              onBlur={() => onFieldBlur("baseUrl")}
              placeholder="https://api.openai.com"
            />
          </EditorField>
          <EditorField
            label={"API Keys"}
            htmlFor="upstream-editor-apiKeys"
            required={false}
            error={errors.apiKeys}
          >
            <PasswordInput
              id="upstream-editor-apiKeys"
              aria-invalid={Boolean(errors.apiKeys)}
              aria-describedby={
                errors.apiKeys ? "upstream-editor-apiKeys-error" : undefined
              }
              visible={showApiKeys}
              onVisibilityChange={onToggleApiKeys}
              value={draft.apiKeys}
              onChange={(event) =>
                onChangeDraft({ apiKeys: event.target.value })
              }
              onBlur={() => onFieldBlur("apiKeys")}
              placeholder="sk-xxxxxxxxxxxx"
            />
          </EditorField>
        </>
      )}

      <EditorField
        label={"ID"}
        htmlFor="upstream-editor-id"
        required
        error={errors.id}
      >
        <Input
          id="upstream-editor-id"
          required
          aria-invalid={Boolean(errors.id)}
          aria-describedby={errors.id ? "upstream-editor-id-error" : undefined}
          value={draft.id}
          disabled={isLocked}
          onChange={(event) => onChangeDraft({ id: event.target.value })}
          onBlur={() => onFieldBlur("id")}
          placeholder="openai"
        />
      </EditorField>

      <EditorField
        label={"优先级"}
        help={"整数，数值越大优先级越高；相同优先级按列表顺序选择。"}
        htmlFor="upstream-editor-priority"
        required
        error={errors.priority}
      >
        <Input
          id="upstream-editor-priority"
          required
          aria-invalid={Boolean(errors.priority)}
          aria-describedby={`upstream-editor-priority-help${
            errors.priority ? " upstream-editor-priority-error" : ""
          }`}
          value={draft.priority}
          onChange={(event) => onChangeDraft({ priority: event.target.value })}
          onBlur={() => onFieldBlur("priority")}
          placeholder="100"
          inputMode="numeric"
        />
      </EditorField>
    </div>
  );
}

type UpstreamOpenAIResponsesFieldsProps = {
  draft: UpstreamForm;
  onChangeDraft: (patch: Partial<UpstreamForm>) => void;
};

function CompatibilitySwitch({
  label,
  help,
  ariaLabel,
  checked,
  onCheckedChange,
}: {
  label: string;
  help: string;
  ariaLabel: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4 py-2 last:pb-0">
      <div className="min-w-0 space-y-0.5">
        <Label className="font-normal">{label}</Label>
        <p className="text-[11px] leading-4 text-muted-foreground">{help}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={ariaLabel}
      />
    </div>
  );
}

function UpstreamOpenAIResponsesFields({
  draft,
  onChangeDraft,
}: UpstreamOpenAIResponsesFieldsProps) {
  const isOpenai = draft.providers.some((value) => value.trim() === "openai");
  const isOpenaiResponses = draft.providers.some(
    (value) => value.trim() === "openai-response",
  );
  if (!isOpenai && !isOpenaiResponses) {
    return null;
  }

  return (
    <div
      data-slot="upstream-compatibility-fields"
      className="col-span-2 divide-y border-t"
    >
      {isOpenaiResponses ? (
        <CompatibilitySwitch
          label={"Responses 使用 chat/completions"}
          help={
            "将 /v1/responses 请求改走 /v1/chat/completions，并转换返回格式。"
          }
          ariaLabel={"切换 Responses 经由 chat/completions"}
          checked={draft.useChatCompletionsForResponses}
          onCheckedChange={(checked) =>
            onChangeDraft({ useChatCompletionsForResponses: checked })
          }
        />
      ) : null}
      {isOpenaiResponses ? (
        <>
          <CompatibilitySwitch
            label={"移除 prompt_cache_retention"}
            help={"转发 /v1/responses 前移除 prompt_cache_retention。"}
            ariaLabel={"切换 prompt_cache_retention"}
            checked={draft.filterPromptCacheRetention}
            onCheckedChange={(checked) =>
              onChangeDraft({ filterPromptCacheRetention: checked })
            }
          />
          <CompatibilitySwitch
            label={"移除 safety_identifier"}
            help={"转发 /v1/responses 前移除 safety_identifier。"}
            ariaLabel={"切换 safety_identifier"}
            checked={draft.filterSafetyIdentifier}
            onCheckedChange={(checked) =>
              onChangeDraft({ filterSafetyIdentifier: checked })
            }
          />
        </>
      ) : null}
      <CompatibilitySwitch
        label={"将 developer 角色改写为 system"}
        help={"转发前将 OpenAI 兼容消息中的 developer 角色改写为 system。"}
        ariaLabel={"切换 developer 角色改写"}
        checked={draft.rewriteDeveloperRoleToSystem}
        onCheckedChange={(checked) =>
          onChangeDraft({ rewriteDeveloperRoleToSystem: checked })
        }
      />
    </div>
  );
}

function UpstreamModelMappingFields({
  draft,
  errors,
  onChangeDraft,
}: UpstreamOpenAIResponsesFieldsProps & {
  errors: Readonly<Record<string, string>>;
}) {
  const handleAdd = () => {
    onChangeDraft({
      modelMappings: [...draft.modelMappings, createModelMapping()],
    });
  };

  return (
    <div data-slot="upstream-model-mapping-fields" className="contents">
      <div className="flex items-center gap-1 self-start">
        <Label className="gap-1.5">
          <span>{"模型映射"}</span>
          <FieldRequirement required={false} />
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={"添加映射"}
          onClick={handleAdd}
        >
          <CirclePlus className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="min-w-0 space-y-2">
        {draft.modelMappings.length ? (
          <ModelMappingsEditor
            mappings={draft.modelMappings}
            errors={errors}
            onChange={(modelMappings) => onChangeDraft({ modelMappings })}
          />
        ) : null}
        <p className="text-[11px] leading-4 text-muted-foreground">
          精确：gpt-4，前缀：gpt-4*，通配：*；按精确、前缀、通配顺序匹配。
        </p>
      </div>
    </div>
  );
}

function UpstreamHeaderOverrideFields({
  draft,
  errors,
  onChangeDraft,
}: UpstreamOpenAIResponsesFieldsProps & {
  errors: Readonly<Record<string, string>>;
}) {
  const handleAdd = () => {
    const next: HeaderOverrideForm = {
      id: `header-override-${Date.now()}-${draft.overrides.header.length}`,
      name: "",
      value: "",
      isNull: false,
    };
    onChangeDraft({ overrides: { header: [...draft.overrides.header, next] } });
  };

  return (
    <div data-slot="upstream-header-override-fields" className="contents">
      <div className="flex items-center gap-1 self-start">
        <Label className="gap-1.5">
          <span>{"请求头覆盖"}</span>
          <FieldRequirement required={false} />
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={"添加请求头"}
          onClick={handleAdd}
        >
          <CirclePlus className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="min-w-0 space-y-2">
        {draft.overrides.header.length ? (
          <HeaderOverridesEditor
            overrides={draft.overrides.header}
            errors={errors}
            onChange={(header) => onChangeDraft({ overrides: { header } })}
          />
        ) : null}
        <p className="text-[11px] leading-4 text-muted-foreground">
          在鉴权请求头之后应用；关闭表示删除该请求头，空值表示发送空字符串。
        </p>
      </div>
    </div>
  );
}

type UpstreamAdvancedFieldsProps = UpstreamOpenAIResponsesFieldsProps;

function UpstreamAdvancedFields({
  draft,
  errors,
  onChangeDraft,
}: UpstreamAdvancedFieldsProps & {
  errors: Readonly<Record<string, string>>;
}) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-[13px] font-semibold leading-5">高级设置</h3>
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5">
        <ConvertFromMapEditor
          key={draft.providers.join("|")}
          providers={draft.providers}
          value={draft.convertFromMap}
          onChange={(convertFromMap) => onChangeDraft({ convertFromMap })}
        />
        <UpstreamModelMappingFields
          draft={draft}
          errors={errors}
          onChangeDraft={onChangeDraft}
        />
        <UpstreamHeaderOverrideFields
          draft={draft}
          errors={errors}
          onChangeDraft={onChangeDraft}
        />
        <UpstreamOpenAIResponsesFields
          draft={draft}
          onChangeDraft={onChangeDraft}
        />
      </div>
    </section>
  );
}

export function UpstreamEditorFields({
  draft,
  errors = {},
  providerOptions,
  showApiKeys,
  onToggleApiKeys,
  onChangeDraft,
  onFieldBlur = () => undefined,
}: UpstreamEditorFieldsProps) {
  return (
    <div data-slot="upstream-editor-fields" className="space-y-4">
      <EditorSection title={"连接"}>
        <UpstreamConnectionFields
          draft={draft}
          errors={errors}
          providerOptions={providerOptions}
          showApiKeys={showApiKeys}
          onToggleApiKeys={onToggleApiKeys}
          onChangeDraft={onChangeDraft}
          onFieldBlur={onFieldBlur}
        />
      </EditorSection>

      <EditorSection title={"模型访问"}>
        <AvailableModelsEditor
          key={draft.providers.join("|")}
          draft={draft}
          error={errors.availableModels}
          onChangeDraft={onChangeDraft}
        />
      </EditorSection>

      <UpstreamAdvancedFields
        draft={draft}
        errors={errors}
        onChangeDraft={onChangeDraft}
      />
    </div>
  );
}
