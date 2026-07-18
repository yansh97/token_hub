import { describe, expect, it } from "vitest";

import {
  UPSTREAM_COLUMNS,
  mergeProviderOptions,
} from "@/features/config/cards/upstreams/constants";

describe("upstreams/constants", () => {
  it("adjusts id, provider, and priority column widths", () => {
    const idColumn = UPSTREAM_COLUMNS.find((column) => column.id === "id");
    const providerColumn = UPSTREAM_COLUMNS.find(
      (column) => column.id === "provider",
    );
    const priorityColumn = UPSTREAM_COLUMNS.find(
      (column) => column.id === "priority",
    );

    expect(idColumn?.headerClassName).toBe("w-[16%]");
    expect(idColumn?.cellClassName).toBe("w-[16%]");
    expect(providerColumn?.headerClassName).toBe("w-[46%]");
    expect(providerColumn?.cellClassName).toBe("w-[46%]");
    expect(priorityColumn?.headerClassName).toBe("w-[10%]");
    expect(priorityColumn?.cellClassName).toBe("w-[10%]");
  });

  it("exposes public API provider options first by default", () => {
    expect(mergeProviderOptions([])).toEqual([
      "openai",
      "openai-response",
      "anthropic",
      "gemini",
    ]);
  });

  it("preserves providers already present in existing config", () => {
    expect(mergeProviderOptions(["kiro", "codex", "legacy-provider"])).toEqual([
      "openai",
      "openai-response",
      "anthropic",
      "gemini",
      "kiro",
      "codex",
      "legacy-provider",
    ]);
  });
});
