import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type ScrollAreaProps = ComponentProps<"div"> & {
  viewportClassName?: string;
};

function ScrollArea({
  className,
  viewportClassName,
  children,
  ...props
}: ScrollAreaProps) {
  return (
    <div
      data-slot="scroll-area"
      className={cn("relative overflow-auto", className)}
      {...props}
    >
      <div
        data-slot="scroll-area-viewport"
        className={cn("min-h-full w-full", viewportClassName)}
      >
        {children}
      </div>
    </div>
  );
}

export { ScrollArea };
