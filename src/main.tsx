import { Toaster } from "@/components/ui/sonner";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/App";

if (typeof window !== "undefined") {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const syncTheme = () => {
    document.documentElement.classList.toggle("dark", media.matches);
  };
  syncTheme();
  media.addEventListener("change", syncTheme);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Toaster position="bottom-right" closeButton richColors />
    <App />
  </React.StrictMode>,
);
