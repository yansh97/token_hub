import { AppShell } from "@/layouts/app-shell";
import { DashboardPanel } from "@/features/dashboard/DashboardPanel";

export function DashboardPage() {
  return (
    <AppShell>
      <DashboardPanel />
    </AppShell>
  );
}
