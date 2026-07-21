import type { ButtonHTMLAttributes } from "react";
import { CheckIcon, MinusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type CheckedState = boolean | "indeterminate";

type CheckboxProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked?: CheckedState;
  onCheckedChange?: (checked: boolean) => void;
};

function Checkbox({
  className,
  checked = false,
  onCheckedChange,
  onClick,
  ...props
}: CheckboxProps) {
  const state =
    checked === "indeterminate" ? "indeterminate" : checked ? "checked" : "unchecked";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked === "indeterminate" ? "mixed" : checked}
      data-slot="checkbox"
      data-state={state}
      className={cn(
        "grid size-4 shrink-0 place-content-center rounded-[4px] border border-input bg-background shadow-xs outline-none transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange?.(checked !== true);
      }}
      {...props}
    >
      {state === "indeterminate" ? (
        <MinusIcon className="size-3.5" aria-hidden="true" />
      ) : state === "checked" ? (
        <CheckIcon className="size-3.5" aria-hidden="true" />
      ) : null}
    </button>
  );
}

export { Checkbox };
