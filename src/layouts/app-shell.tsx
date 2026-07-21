import type { ReactNode } from "react";

import { AppSidebar } from "@/layouts/app-sidebar";

type AppShellProps = {
  children: ReactNode;
  contentMode?: "document" | "workspace";
};

export function AppShell({
  children,
  contentMode = "document",
}: AppShellProps) {
  const workspace = contentMode === "workspace";

  return (
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <AppSidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <div
          data-slot="app-shell-viewport"
          data-content-mode={contentMode}
          className={`min-h-0 flex-1 overscroll-none ${
            workspace ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          <div
            data-slot="app-shell-content"
            className={`mx-auto flex w-full max-w-[1480px] flex-col px-5 py-5 lg:px-7 lg:py-6 ${
              workspace ? "h-full min-h-0" : "min-h-full"
            }`}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
