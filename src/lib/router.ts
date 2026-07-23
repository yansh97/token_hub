import { useSyncExternalStore } from "react";

import {
  type ConfigSectionId,
  DEFAULT_CONFIG_SECTION,
  toConfigSectionId,
} from "@/features/config/sections";

const ROUTE_CHANGE_EVENT = "token-hub-route-change";

function readRouteFromHash(): ConfigSectionId {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG_SECTION;
  }

  const value = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  return toConfigSectionId(value) ?? DEFAULT_CONFIG_SECTION;
}

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener(ROUTE_CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener(ROUTE_CHANGE_EVENT, listener);
  };
}

export function getRouteHash(route: ConfigSectionId) {
  return `#/${route}`;
}

export function navigateTo(route: ConfigSectionId, replace = false) {
  const hash = getRouteHash(route);
  if (replace) {
    window.history.replaceState(null, "", hash);
    window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT));
    return;
  }
  window.location.hash = hash;
}

export function useAppRoute() {
  return useSyncExternalStore(
    subscribe,
    readRouteFromHash,
    () => DEFAULT_CONFIG_SECTION,
  );
}
