import type { ReactNode } from "react";
import { CircleX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldRequirement } from "@/components/ui/field-meta";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type {
  HeaderOverrideForm,
  ModelMappingForm,
  UpstreamForm,
} from "@/features/config/types";

type EditorFieldProps = {
  label: string;
  htmlFor?: string;
  labelClassName?: string;
  help?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
};

/** 单个字段：label 左侧，控件和说明文字右侧。 */
export function EditorField({
  label,
  htmlFor,
  labelClassName,
  help,
  required = false,
  error,
  children,
}: EditorFieldProps) {
  return (
    <>
      <div className={cn("flex items-center self-start pt-2", labelClassName)}>
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="gap-1.5">
            <span>{label}</span>
            <FieldRequirement required={required} />
          </Label>
        ) : (
          <Label className="gap-1.5">
            <span>{label}</span>
            <FieldRequirement required={required} />
          </Label>
        )}
      </div>
      <div className="min-w-0 space-y-1">
        {children}
        {help ? (
          <p
            id={htmlFor ? `${htmlFor}-help` : undefined}
            className="text-[11px] leading-4 text-muted-foreground"
          >
            {help}
          </p>
        ) : null}
        <FieldError
          id={htmlFor ? `${htmlFor}-error` : undefined}
          message={error}
        />
      </div>
    </>
  );
}

type ModelMappingsEditorProps = {
  mappings: ModelMappingForm[];
  errors?: Readonly<Record<string, string>>;
  onChange: (next: ModelMappingForm[]) => void;
};

export function ModelMappingsEditor({
  mappings,
  errors = {},
  onChange,
}: ModelMappingsEditorProps) {
  const handleUpdate = (index: number, patch: Partial<ModelMappingForm>) => {
    onChange(
      mappings.map((mapping, current) =>
        current === index ? { ...mapping, ...patch } : mapping,
      ),
    );
  };

  const handleRemove = (index: number) => {
    onChange(mappings.filter((_, current) => current !== index));
  };

  return (
    <div data-slot="model-mappings" className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          匹配模式
          <FieldRequirement required />
        </span>
        <span className="flex items-center gap-1">
          目标模型
          <FieldRequirement required />
        </span>
        <span className="sr-only">{"删除映射"}</span>
      </div>
      {mappings.map((mapping, index) => (
        <div key={mapping.id} className="space-y-1">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2">
            <Input
              value={mapping.pattern}
              onChange={(e) => handleUpdate(index, { pattern: e.target.value })}
              placeholder={"gpt-4*"}
              required
              aria-invalid={Boolean(
                errors[`modelMappings.${mapping.id}.pattern`],
              )}
              aria-describedby={
                errors[`modelMappings.${mapping.id}.pattern`]
                  ? `model-mapping-${mapping.id}-pattern-error`
                  : undefined
              }
            />
            <Input
              value={mapping.target}
              onChange={(e) => handleUpdate(index, { target: e.target.value })}
              placeholder={"gpt-4.1"}
              required
              aria-invalid={Boolean(
                errors[`modelMappings.${mapping.id}.target`],
              )}
              aria-describedby={
                errors[`modelMappings.${mapping.id}.target`]
                  ? `model-mapping-${mapping.id}-target-error`
                  : undefined
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={"删除映射"}
              onClick={() => handleRemove(index)}
            >
              <CircleX className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FieldError
              id={`model-mapping-${mapping.id}-pattern-error`}
              message={errors[`modelMappings.${mapping.id}.pattern`]}
            />
            <FieldError
              id={`model-mapping-${mapping.id}-target-error`}
              message={errors[`modelMappings.${mapping.id}.target`]}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

type HeaderOverridesEditorProps = {
  overrides: UpstreamForm["overrides"]["header"];
  errors?: Readonly<Record<string, string>>;
  onChange: (next: UpstreamForm["overrides"]["header"]) => void;
};

export function HeaderOverridesEditor({
  overrides,
  errors = {},
  onChange,
}: HeaderOverridesEditorProps) {
  const handleUpdate = (index: number, patch: Partial<HeaderOverrideForm>) => {
    onChange(
      overrides.map((item, current) =>
        current === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const handleRemove = (index: number) => {
    onChange(overrides.filter((_, current) => current !== index));
  };

  return (
    <div data-slot="header-overrides" className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem_2rem] gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          请求头名称
          <FieldRequirement required />
        </span>
        <span>{"请求头值"}</span>
        <span className="sr-only">{"启用"}</span>
        <span className="sr-only">{"删除Header"}</span>
      </div>
      {overrides.map((item, index) => (
        <div key={item.id} className="space-y-1">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem_2rem] items-center gap-2">
            <Input
              value={item.name}
              onChange={(e) => handleUpdate(index, { name: e.target.value })}
              placeholder={"x-forwarded-for"}
              required
              aria-invalid={Boolean(errors[`headerOverrides.${item.id}.name`])}
              aria-describedby={
                errors[`headerOverrides.${item.id}.name`]
                  ? `header-override-${item.id}-name-error`
                  : undefined
              }
            />
            <Input
              value={item.isNull ? "" : item.value}
              onChange={(e) =>
                handleUpdate(index, { value: e.target.value, isNull: false })
              }
              placeholder={"client"}
              disabled={item.isNull}
            />
            <Switch
              checked={!item.isNull}
              aria-label={item.isNull ? "启用请求头" : "停用请求头"}
              onCheckedChange={(enabled) =>
                handleUpdate(index, { isNull: !enabled })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={"删除Header"}
              onClick={() => handleRemove(index)}
            >
              <CircleX className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <FieldError
            id={`header-override-${item.id}-name-error`}
            message={errors[`headerOverrides.${item.id}.name`]}
          />
        </div>
      ))}
    </div>
  );
}
