import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getRouteHash, navigateTo, useAppRoute } from "@/lib/router";

describe("lib/router", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "#/dashboard");
  });

  it("reads the current route from the hash", () => {
    window.history.replaceState(null, "", "#/logs");

    const { result } = renderHook(() => useAppRoute());

    expect(result.current).toBe("logs");
  });

  it("falls back to the dashboard for unknown routes", () => {
    window.history.replaceState(null, "", "#/unknown");

    const { result } = renderHook(() => useAppRoute());

    expect(result.current).toBe("dashboard");
  });

  it("navigates with native hashes", () => {
    const { result } = renderHook(() => useAppRoute());

    act(() => navigateTo("settings", true));

    expect(result.current).toBe("settings");
    expect(window.location.hash).toBe(getRouteHash("settings"));
  });
});
