import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Consumers provide htmlFor or wrap the associated control.
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-[13px] leading-none font-medium select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
