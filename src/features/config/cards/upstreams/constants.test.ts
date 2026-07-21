import { describe, expect, it } from "vitest";

import { UPSTREAM_COLUMNS } from "@/features/config/cards/upstreams/constants";

describe("upstreams/constants", () => {
  it("allocates every data column by percentage", () => {
    const idColumn = UPSTREAM_COLUMNS.find((column) => column.id === "id");
    const providerColumn = UPSTREAM_COLUMNS.find(
      (column) => column.id === "provider",
    );
    const priorityColumn = UPSTREAM_COLUMNS.find(
      (column) => column.id === "priority",
    );
    const statusColumn = UPSTREAM_COLUMNS.find(
      (column) => column.id === "status",
    );

    expect(idColumn?.headerClassName).toBe("w-[16%]");
    expect(idColumn?.cellClassName).toBe("w-[16%]");
    expect(providerColumn?.headerClassName).toBe("w-[42%]");
    expect(providerColumn?.cellClassName).toBe("w-[42%]");
    expect(priorityColumn?.headerClassName).toBe("w-[10%]");
    expect(priorityColumn?.cellClassName).toBe("w-[10%]");
    expect(statusColumn?.headerClassName).toBe("w-[12%]");
    expect(statusColumn?.cellClassName).toBe("w-[12%]");
  });
});
