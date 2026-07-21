import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UPSTREAM_COLUMNS } from "@/features/config/cards/upstreams/constants";
import { UpstreamsTable } from "@/features/config/cards/upstreams/table";
import type { UpstreamForm } from "@/features/config/types";

const LONG_ID = "openai-provider-with-a-very-long-upstream-id-for-tooltip";

afterEach(() => {
  cleanup();
});

function buildUpstream(): UpstreamForm {
  return {
    id: LONG_ID,
    providers: ["openai"],
    baseUrl: "https://api.example.com/v1",
    apiKeys: "",
    filterPromptCacheRetention: false,
    filterSafetyIdentifier: false,
    useChatCompletionsForResponses: false,
    rewriteDeveloperRoleToSystem: false,
    proxyUrl: "",
    priority: "10",
    enabled: true,
    availableModelsMode: "all",
    availableModels: [],
    modelMappings: [],
    convertFromMap: {},
    overrides: { header: [] },
  };
}

describe("upstreams/table", () => {
  it("renders an outer border around the list", () => {
    render(
      <UpstreamsTable
        upstreams={[buildUpstream()]}
        columns={UPSTREAM_COLUMNS}
        disableDelete={false}
        onEdit={() => undefined}
        onCopy={() => undefined}
        onToggleEnabled={() => undefined}
        onDelete={() => undefined}
      />,
    );

    const scrollArea = screen.getByRole("table").parentElement;
    expect(scrollArea).toHaveClass(
      "rounded-md",
      "border",
      "border-border/70",
      "min-h-0",
      "max-h-full",
      "overflow-x-auto",
      "overflow-y-auto",
      "overscroll-none",
    );
    const headerGroup = screen.getAllByRole("rowgroup")[0];
    expect(headerGroup).toHaveClass("sticky", "top-0");
    for (const header of screen.getAllByRole("columnheader")) {
      expect(header).toHaveClass(
        "bg-background",
        "shadow-[inset_0_-1px_0_var(--border)]",
      );
    }
  });

  it("keeps the full id available for truncated cells", () => {
    render(
      <UpstreamsTable
        upstreams={[buildUpstream()]}
        columns={UPSTREAM_COLUMNS}
        disableDelete={false}
        onEdit={() => undefined}
        onCopy={() => undefined}
        onToggleEnabled={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(screen.getByText(LONG_ID)).toHaveAttribute("title", LONG_ID);
  });

  it("keeps the actions column in the normal table layer", () => {
    render(
      <UpstreamsTable
        upstreams={[buildUpstream()]}
        columns={UPSTREAM_COLUMNS}
        disableDelete={false}
        onEdit={() => undefined}
        onCopy={() => undefined}
        onToggleEnabled={() => undefined}
        onDelete={() => undefined}
      />,
    );

    const header = screen.getByRole("columnheader", { name: "操作" });
    const actionButton = screen.getByRole("button", {
      name: "编辑提供商 1",
    });
    const actionCell = actionButton.closest("td");

    expect(header).not.toHaveClass("sticky", "right-0", "z-20");
    expect(header).toHaveClass("text-left");
    expect(header).toHaveClass("w-[20%]");
    expect(header).not.toHaveClass("text-right");
    expect(actionCell).not.toBeNull();
    expect(actionCell).not.toHaveClass(
      "sticky",
      "right-0",
      "z-10",
      "bg-background",
    );
    expect(actionCell?.firstElementChild).toHaveClass("justify-start");
    expect(actionCell?.firstElementChild).not.toHaveClass("justify-end");
    expect(actionCell).toHaveClass("w-[20%]");
  });
});
