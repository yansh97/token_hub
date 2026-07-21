import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEmptyUpstream, EMPTY_FORM, toPayload } from "@/features/config/form";
import {
  syncManagedXaiDefaultUpstreams,
  syncXaiDefaultUpstreamConfig,
} from "@/features/config/sync-xai-default-upstream";

const xaiApiMocks = vi.hoisted(() => ({
  listXaiAccounts: vi.fn(),
}));

vi.mock("@/features/xai/api", () => ({
  listXaiAccounts: xaiApiMocks.listXaiAccounts,
}));

function createConfigWithXaiUpstreams(ids: string[]) {
  const upstreams = ids.map((id) => {
    const upstream = createEmptyUpstream();
    upstream.id = id;
    upstream.providers = ["xai"];
    upstream.enabled = true;
    return upstream;
  });
  return toPayload({ ...EMPTY_FORM, upstreams });
}

function createSaveResult() {
  return {
    status: { state: "running" as const, addr: "127.0.0.1:9208", last_error: null },
    apply_error: null,
  };
}

describe("config/sync-xai-default-upstream", () => {
  beforeEach(() => {
    xaiApiMocks.listXaiAccounts.mockReset();
  });

  afterEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("preserves custom xai upstreams and changes only xai-default", () => {
    const customOnly = createConfigWithXaiUpstreams(["xai-custom"]).upstreams;

    expect(syncManagedXaiDefaultUpstreams(customOnly, false)).toBe(customOnly);
    expect(syncManagedXaiDefaultUpstreams(customOnly, true).map((upstream) => upstream.id)).toEqual([
      "xai-custom",
      "xai-default",
    ]);

    const withManaged = createConfigWithXaiUpstreams(["xai-custom", "xai-default"]).upstreams;
    expect(syncManagedXaiDefaultUpstreams(withManaged, false).map((upstream) => upstream.id)).toEqual([
      "xai-custom",
    ]);
  });

  it("persists xai-default immediately when an account exists", async () => {
    const invokeMock = vi.mocked(invoke);
    const config = createConfigWithXaiUpstreams(["xai-custom"]);
    xaiApiMocks.listXaiAccounts.mockResolvedValue([{ account_id: "xai-1" }]);
    invokeMock.mockImplementation(async (command) => {
      if (command === "read_proxy_config") {
        return { path: "/tmp/config.json", config };
      }
      if (command === "save_proxy_config") {
        return createSaveResult();
      }
      throw new Error(`unexpected command: ${command}`);
    });

    await expect(syncXaiDefaultUpstreamConfig()).resolves.toBe(true);
    expect(
      invokeMock.mock.calls.find(([command]) => command === "save_proxy_config")?.[1]
    ).toMatchObject({
      config: expect.objectContaining({
        upstreams: [
          expect.objectContaining({ id: "xai-custom" }),
          expect.objectContaining({ id: "xai-default", providers: ["xai"] }),
        ],
      }),
    });
  });

  it("removes only xai-default after the last account is deleted", async () => {
    const invokeMock = vi.mocked(invoke);
    const config = createConfigWithXaiUpstreams(["xai-custom", "xai-default"]);
    xaiApiMocks.listXaiAccounts.mockResolvedValue([]);
    invokeMock.mockImplementation(async (command) => {
      if (command === "read_proxy_config") {
        return { path: "/tmp/config.json", config };
      }
      if (command === "save_proxy_config") {
        return createSaveResult();
      }
      throw new Error(`unexpected command: ${command}`);
    });

    await expect(syncXaiDefaultUpstreamConfig()).resolves.toBe(true);
    expect(
      invokeMock.mock.calls.find(([command]) => command === "save_proxy_config")?.[1]
    ).toMatchObject({
      config: expect.objectContaining({
        upstreams: [expect.objectContaining({ id: "xai-custom" })],
      }),
    });
  });
});
