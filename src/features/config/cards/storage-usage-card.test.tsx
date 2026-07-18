import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

import { StorageUsageCard } from "@/features/config/cards/storage-usage-card";
import { m } from "@/paraglide/messages.js";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("StorageUsageCard", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("loads storage usage and renders breakdown rows", async () => {
    invokeMock.mockResolvedValue({
      dataDir: "/tmp/token-proxy",
      totalBytes: 1536,
      databaseBytes: 1024,
      configBytes: 256,
      otherBytes: 256,
    });

    render(<StorageUsageCard />);
    const card = await screen.findByTestId("storage-usage-card");

    await waitFor(() => {
      expect(within(card).getByText("/tmp/token-proxy")).toBeInTheDocument();
    });
    expect(
      within(card).getByText(m.storage_usage_database_label()),
    ).toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith("read_data_storage_usage");
  });

  it("shows error and allows refresh retry", async () => {
    const user = userEvent.setup();
    invokeMock
      .mockRejectedValueOnce(new Error("disk busy"))
      .mockResolvedValueOnce({
        dataDir: "/tmp/token-proxy",
        totalBytes: 10,
        databaseBytes: 10,
        configBytes: 0,
        otherBytes: 0,
      });

    render(<StorageUsageCard />);
    const card = await screen.findByTestId("storage-usage-card");

    await waitFor(() => {
      expect(
        within(card).getByText(m.storage_usage_error({ message: "disk busy" })),
      ).toBeInTheDocument();
    });

    await user.click(
      within(card).getByRole("button", { name: m.storage_usage_refresh() }),
    );

    await waitFor(() => {
      expect(within(card).getByText("/tmp/token-proxy")).toBeInTheDocument();
    });
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });
});
