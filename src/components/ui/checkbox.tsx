import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type CheckedState = boolean | "indeterminate";

type CheckboxProps = Omit<
  CheckboxPrimitive.Root.Props,
  "checked" | "indeterminate"
> & {
  checked?: CheckedState;
};

function Checkbox({ className, checked = false, ...props }: CheckboxProps) {
  const indeterminate = checked === "indeterminate";
  const state = indeterminate
    ? "indeterminate"
    : checked
      ? "checked"
      : "unchecked";

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      data-state={state}
      checked={checked === true}
      indeterminate={indeterminate}
      className={cn(
        "grid size-4 shrink-0 place-content-center rounded-[4px] border border-input bg-background shadow-xs outline-none transition-colors data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <MinusIcon
          className={cn("size-3.5", !indeterminate && "hidden")}
          aria-hidden="true"
        />
        <CheckIcon
          className={cn("size-3.5", indeterminate && "hidden")}
          aria-hidden="true"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
