import { LanguageObserver } from "@/components/LanguageObserver";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";
import { setLocale } from "@/paraglide/runtime.js";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { Agentation } from "agentation";
import { ThemeProvider } from "next-themes";
import React from "react";
import ReactDOM from "react-dom/client";
import { routeTree } from "./routeTree.gen";

const THEME_STORAGE_KEY = "token-proxy-theme";

if (typeof window !== "undefined") {
  window.localStorage.setItem(THEME_STORAGE_KEY, "system");
}

setLocale("zh", { reload: false });

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {import.meta.env.DEV && (
      <Agentation
        endpoint="http://localhost:4747"
        onSessionCreated={(sessionId) => {
          console.log("Session started:", sessionId);
        }}
      />
    )}
    <I18nProvider>
      {/* Follow system theme and persist to localStorage; class drives dark styles. */}
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey={THEME_STORAGE_KEY}
        disableTransitionOnChange
      >
        <Toaster position="bottom-right" closeButton richColors />
        <RouterProvider router={router} />
        {/* Isolated language subscription - prevents global re-renders when language changes */}
        <LanguageObserver />
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>,
);
