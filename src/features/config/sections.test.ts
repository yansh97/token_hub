import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONFIG_SECTION,
  toConfigSectionId,
} from "@/features/config/sections";

describe("config/sections", () => {
  it("accepts known section ids", () => {
    expect(toConfigSectionId("upstreams")).toBe("upstreams");
    expect(toConfigSectionId("settings")).toBe("settings");
  });

  it("rejects unknown section ids", () => {
    expect(toConfigSectionId("unknown")).toBeNull();
    expect(DEFAULT_CONFIG_SECTION).toBe("dashboard");
  });
});
