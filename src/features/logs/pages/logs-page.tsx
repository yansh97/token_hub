import { LogsPanel } from "@/features/logs/LogsPanel";
import { AppShell } from "@/layouts/app-shell";

export function LogsPage() {
  return (
    <AppShell contentMode="workspace">
      <LogsPanel />
    </AppShell>
  );
}
