import {
  createContext,
  useContext,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type ToggleGroupType = "single" | "multiple";

type ToggleGroupContextValue = {
  type: ToggleGroupType;
  value: readonly string[];
  disabled: boolean;
  variant: "default" | "outline";
  size: "default" | "sm" | "lg";
  spacing: number;
  toggle: (value: string) => void;
};

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null);

type ToggleGroupValue<T extends ToggleGroupType> = T extends "multiple"
  ? string[]
  : string;

type ToggleGroupProps<T extends ToggleGroupType> = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "defaultValue" | "onChange"
> & {
  type: T;
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: ToggleGroupValue<T>) => void;
  disabled?: boolean;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
  spacing?: number;
  children: ReactNode;
};

function normalizeValue(type: ToggleGroupType, value?: string | string[]) {
  if (type === "multiple") return Array.isArray(value) ? value : [];
  return typeof value === "string" && value ? [value] : [];
}

function ToggleGroup<T extends ToggleGroupType>({
  className,
  type,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  variant = "default",
  size = "default",
  spacing = 0,
  children,
  ...props
}: ToggleGroupProps<T>) {
  const selected = normalizeValue(type, value ?? defaultValue);

  const toggle = (itemValue: string) => {
    if (disabled) return;
    if (type === "multiple") {
      (onValueChange as ((value: string[]) => void) | undefined)?.(
        selected.includes(itemValue)
          ? selected.filter((item) => item !== itemValue)
          : [...selected, itemValue],
      );
      return;
    }
    (onValueChange as ((value: string) => void) | undefined)?.(
      selected.includes(itemValue) ? "" : itemValue,
    );
  };

  return (
    <ToggleGroupContext.Provider
      value={{ type, value: selected, disabled, variant, size, spacing, toggle }}
    >
      <div
        role="group"
        data-slot="toggle-group"
        data-variant={variant}
        data-size={size}
        data-spacing={spacing}
        className={cn("flex w-fit items-center rounded-md", spacing ? "gap-1" : "", className)}
        {...props}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

type ToggleGroupItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
};

function ToggleGroupItem({
  className,
  value,
  variant,
  size,
  onClick,
  ...props
}: ToggleGroupItemProps) {
  const context = useContext(ToggleGroupContext);
  if (!context) throw new Error("ToggleGroupItem must be used inside ToggleGroup");

  const active = context.value.includes(value);
  const itemVariant = variant ?? context.variant;
  const itemSize = size ?? context.size;

  return (
    <button
      type="button"
      aria-pressed={active}
      data-slot="toggle-group-item"
      data-state={active ? "on" : "off"}
      data-variant={itemVariant}
      data-size={itemSize}
      data-spacing={context.spacing}
      disabled={context.disabled || props.disabled}
      className={cn(
        "inline-flex min-w-0 shrink-0 items-center justify-center whitespace-nowrap rounded-md text-[13px] font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent",
        itemVariant === "outline" && "border border-input bg-transparent shadow-xs",
        itemSize === "lg" ? "h-9 px-4" : "h-8 px-3",
        context.spacing === 0 && "rounded-none first:rounded-l-md last:rounded-r-md not-first:border-l-0",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) context.toggle(value);
      }}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
