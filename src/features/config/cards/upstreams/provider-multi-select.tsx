import { getProviderLabel } from "@/features/config/cards/upstreams/constants";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ProviderMultiSelectProps = {
  providerOptions: readonly string[];
  value: readonly string[];
  disabled?: boolean;
  error?: string;
  onChange: (next: string[]) => void;
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

function orderProviders(
  values: readonly string[],
  providerOptions: readonly string[],
) {
  const index = new Map<string, number>();
  providerOptions.forEach((value, idx) => {
    index.set(value, idx);
  });
  return [...values].sort((left, right) => {
    const leftIndex = index.get(left);
    const rightIndex = index.get(right);
    if (leftIndex !== undefined && rightIndex !== undefined) {
      return leftIndex - rightIndex;
    }
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return left.localeCompare(right);
  });
}

function toggleProvider(
  current: readonly string[],
  providerOptions: readonly string[],
  provider: string,
  checked: boolean,
) {
  const normalized = normalizeProviders(current);
  if (!checked) {
    const next = normalized.filter((value) => value !== provider);
    // provider 必选：禁止清空最后一个选项（否则会导致后续字段“不同步/消失”）
    return next.length ? next : normalized;
  }

  return orderProviders([...normalized, provider], providerOptions);
}

export function ProviderMultiSelect({
  providerOptions,
  value,
  disabled = false,
  error,
  onChange,
}: ProviderMultiSelectProps) {
  const selected = orderProviders(normalizeProviders(value), providerOptions);
  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      size="sm"
      spacing={1}
      disabled={disabled}
      aria-invalid={Boolean(error)}
      value={selected}
      onValueChange={(next) => {
        const nextSet = new Set(next);
        const changedOption = providerOptions.find(
          (option) => nextSet.has(option) !== selected.includes(option),
        );
        if (!changedOption || disabled) {
          return;
        }
        onChange(
          toggleProvider(
            selected,
            providerOptions,
            changedOption,
            nextSet.has(changedOption),
          ),
        );
      }}
      className="grid w-full grid-cols-2 gap-1 sm:grid-cols-[1fr_1.25fr_1fr_1fr]"
      data-slot="provider-multi-select"
    >
      {providerOptions.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          className="w-full px-2 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {getProviderLabel(option)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
