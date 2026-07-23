import { DashboardPanel } from "@/features/dashboard/DashboardPanel";
import { AppShell } from "@/layouts/app-shell";

export function DashboardPage() {
  return (
    <AppShell>
      <DashboardPanel />
    </AppShell>
  );
}
