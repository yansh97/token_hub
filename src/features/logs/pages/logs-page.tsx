import { AppShell } from "@/layouts/app-shell";
import { LogsPanel } from "@/features/logs/LogsPanel";

export function LogsPage() {
  return (
    <AppShell contentMode="workspace">
      <LogsPanel />
    </AppShell>
  );
}
