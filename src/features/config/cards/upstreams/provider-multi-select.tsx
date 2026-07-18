import { isAccountBackedProvider } from "@/features/config/cards/upstreams/upstream-editor-helpers";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ProviderMultiSelectProps = {
  providerOptions: readonly string[];
  value: readonly string[];
  disabled?: boolean;
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
  providerOptions.forEach((value, idx) => index.set(value, idx));
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

  if (isAccountBackedProvider(provider)) {
    return [provider];
  }
  const specialSelected = normalized.find(isAccountBackedProvider);
  const next = specialSelected ? [provider] : [...normalized, provider];
  return orderProviders(next, providerOptions);
}

export function ProviderMultiSelect({
  providerOptions,
  value,
  disabled = false,
  onChange,
}: ProviderMultiSelectProps) {
  const selected = orderProviders(normalizeProviders(value), providerOptions);
  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      size="sm"
      spacing={0}
      disabled={disabled}
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
      className="max-w-full overflow-x-auto"
      data-slot="provider-multi-select"
    >
      {providerOptions.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {option}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
