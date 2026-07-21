import { describe, expect, it } from "vitest";

import {
  coerceProviderSelection,
  isAccountBackedProviderSet,
} from "@/features/config/cards/upstreams/upstream-editor-helpers";

describe("upstreams/upstream-editor-helpers", () => {
  it("treats account-backed providers as single-provider selections", () => {
    expect(isAccountBackedProviderSet(["kiro"])).toBe(true);
    expect(isAccountBackedProviderSet(["codex"])).toBe(true);
    expect(isAccountBackedProviderSet(["antigravity"])).toBe(true);
    expect(isAccountBackedProviderSet(["openai"])).toBe(false);
    expect(isAccountBackedProviderSet(["antigravity", "openai"])).toBe(false);
  });

  it("coerces account-backed providers to exclusive selections", () => {
    expect(coerceProviderSelection(["openai", "antigravity"])).toEqual([
      "antigravity",
    ]);
    expect(coerceProviderSelection(["codex", "antigravity"])).toEqual([
      "codex",
    ]);
  });
});
