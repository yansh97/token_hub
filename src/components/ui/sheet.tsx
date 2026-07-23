import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Sheet(props: Dialog.Root.Props) {
  return <Dialog.Root {...props} />;
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: Dialog.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px] transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <Dialog.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col bg-background shadow-2xl outline-none transition-transform duration-200 data-ending-style:translate-x-full data-starting-style:translate-x-full",
          side === "right" &&
            "inset-y-0 right-0 h-full w-[min(46rem,calc(100vw-2rem))] border-l",
          side === "left" && "inset-y-0 left-0 h-full w-3/4 border-r",
          side === "top" && "inset-x-0 top-0 max-h-[85vh] border-b",
          side === "bottom" && "inset-x-0 bottom-0 max-h-[85vh] border-t",
          className,
        )}
        {...props}
      >
        {children}
        <Dialog.Close
          aria-label="关闭"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
        >
          <X className="size-4" aria-hidden="true" />
        </Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

function SheetTitle({ className, ...props }: Dialog.Title.Props) {
  return (
    <Dialog.Title
      className={cn(
        "text-[15px] font-semibold leading-5 text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: Dialog.Description.Props) {
  return (
    <Dialog.Description
      className={cn("text-[12px] leading-4 text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle };
