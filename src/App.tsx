import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { useEffect } from "react";

import { SettingsPage } from "@/features/config/pages/settings-page";
import { UpstreamsPage } from "@/features/config/pages/upstreams-page";
import { DashboardPage } from "@/features/dashboard/pages/dashboard-page";
import { handleKiroCallback } from "@/features/kiro/api";
import { LogsPage } from "@/features/logs/pages/logs-page";
import { UpdateNotifier } from "@/features/update/UpdateNotifier";
import { UpdaterProvider } from "@/features/update/updater";
import { useAppRoute } from "@/lib/router";

import "./App.css";

function App() {
  const route = useAppRoute();

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    onOpenUrl((urls) => {
      for (const url of urls) {
        if (url.startsWith("kiro://")) {
          void handleKiroCallback(url);
        }
      }
    })
      .then((stop) => {
        unlisten = stop;
      })
      .catch(() => {});
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const page = (() => {
    switch (route) {
      case "upstreams":
        return <UpstreamsPage />;
      case "logs":
        return <LogsPage />;
      case "settings":
        return <SettingsPage />;
      case "dashboard":
        return <DashboardPage />;
      default:
        return <DashboardPage />;
    }
  })();

  return (
    <UpdaterProvider>
      <UpdateNotifier />
      <main className="app-shell">
        <div data-slot="app-shell" className="relative z-10 h-full min-h-0">
          {page}
        </div>
      </main>
    </UpdaterProvider>
  );
}

export default App;
