import { ArrowRight } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { getProviderLabel } from "@/features/config/cards/upstreams/constants";
import { EditorField } from "@/features/config/cards/upstreams/editor-fields";
import {
  createNativeInboundFormatSet,
  INBOUND_FORMAT_OPTIONS,
  removeInboundFormatsInSet,
} from "@/features/config/inbound-formats";
import type { InboundApiFormat, UpstreamForm } from "@/features/config/types";

type ConvertFromMapEditorProps = {
  providers: readonly string[];
  value: UpstreamForm["convertFromMap"];
  onChange: (next: UpstreamForm["convertFromMap"]) => void;
};

function normalizeProviders(values: readonly string[]) {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    output.push(trimmed);
  }
  return output;
}

function toggleInboundFormat(
  current: readonly InboundApiFormat[],
  format: InboundApiFormat,
  checked: boolean,
) {
  if (!checked) {
    return current.filter((value) => value !== format);
  }
  if (current.includes(format)) {
    return [...current];
  }
  return [...current, format];
}

export function ConvertFromMapEditor({
  providers,
  value,
  onChange,
}: ConvertFromMapEditorProps) {
  const normalizedProviders = normalizeProviders(providers);
  if (!normalizedProviders.length) {
    return null;
  }

  // “可转格式”只展示“非原生格式”的转换授权：
  // - 若该 upstream 已包含某入站格式的原生 provider，则该入站格式无需也不应再被其它 provider 转换兜底（避免误导）。
  const nativeFormatsInUpstream =
    createNativeInboundFormatSet(normalizedProviders);
  const sourceFormats = INBOUND_FORMAT_OPTIONS.filter(
    (option) => !nativeFormatsInUpstream.has(option.value),
  );
  const targetOptions = normalizedProviders.map((provider) => ({
    provider,
    selected: removeInboundFormatsInSet(
      value[provider] ?? [],
      nativeFormatsInUpstream,
    ),
  }));
  return (
    <div data-slot="convert-from-map-editor" className="contents">
      <EditorField
        label="可转格式"
        labelClassName="self-start pt-1"
        help="勾选允许未选择的入站格式转换为已选择的目标格式。"
      >
        {sourceFormats.length ? (
          <div className="space-y-2.5 py-0.5">
            {sourceFormats.map((source) => (
              <div
                key={source.value}
                data-slot="conversion-source-row"
                className="grid grid-cols-[8rem_0.875rem_minmax(0,1fr)] items-start gap-2"
              >
                <span className="pt-0.5 text-[12px] leading-4 text-muted-foreground">
                  {source.label}
                </span>
                <ArrowRight
                  className="mt-0.5 size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-2">
                  {targetOptions.map(({ provider, selected }) => {
                    const targetLabel = getProviderLabel(provider);
                    const checked = selected.includes(source.value);
                    return (
                      <div
                        key={provider}
                        className="flex items-center gap-1.5 text-[12px] font-normal leading-4"
                      >
                        <Checkbox
                          checked={checked}
                          aria-label={`允许 ${source.label} 转换为 ${targetLabel}`}
                          onCheckedChange={(nextChecked) => {
                            const nextFormats = toggleInboundFormat(
                              selected,
                              source.value,
                              nextChecked === true,
                            );
                            const next: UpstreamForm["convertFromMap"] = {
                              ...value,
                              [provider]: nextFormats,
                            };
                            if (!nextFormats.length) {
                              delete next[provider];
                            }
                            onChange(next);
                          }}
                        />
                        <span>{targetLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <span className="pt-1 text-[13px] text-muted-foreground">
            无可用选项
          </span>
        )}
      </EditorField>
    </div>
  );
}
