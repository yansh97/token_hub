import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { UPSTREAM_COLUMNS } from "@/features/config/cards/upstreams/constants";
import { UpstreamsTable } from "@/features/config/cards/upstreams/table";
import type { UpstreamForm } from "@/features/config/types";

const LONG_ID = "codex-account-with-a-very-long-upstream-id-for-tooltip";

afterEach(() => {
  cleanup();
});

function buildUpstream(): UpstreamForm {
  return {
    id: LONG_ID,
    providers: ["codex"],
    baseUrl: "https://api.example.com/v1",
    apiKeys: "",
    filterPromptCacheRetention: false,
    filterSafetyIdentifier: false,
    useChatCompletionsForResponses: false,
    rewriteDeveloperRoleToSystem: false,
    preferredEndpoint: "",
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
      "border-border/60",
      "min-h-0",
      "max-h-full",
      "overflow-x-hidden",
      "overflow-y-auto",
      "overscroll-none",
    );
    const headerGroup = screen.getAllByRole("rowgroup")[0];
    expect(headerGroup).toHaveClass("sticky", "top-0");
    expect(headerGroup?.firstElementChild).toHaveClass("bg-background/40");
  });

  it("shows tooltip for truncated id cells on hover", async () => {
    const user = userEvent.setup();

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

    const idCell = screen.getByText(LONG_ID);
    await user.hover(idCell);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(LONG_ID);
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

    const header = screen.getByRole("columnheader", { name: "Actions" });
    const actionButton = screen.getByRole("button", {
      name: /edit upstream/i,
    });
    const actionCell = actionButton.closest("td");

    expect(header).not.toHaveClass("sticky", "right-0", "z-20");
    expect(header).toHaveClass("text-left");
    expect(header).toHaveClass("w-[20%]", "min-w-[10rem]");
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
    expect(actionCell).toHaveClass("w-[20%]", "min-w-[10rem]");
  });

  it("disables delete for account-backed special upstream rows", () => {
    render(
      <UpstreamsTable
        upstreams={[buildUpstream()]}
        columns={UPSTREAM_COLUMNS}
        disableDelete={false}
        isDeleteDisabled={(upstream) =>
          upstream.providers.length === 1 && upstream.providers[0] === "codex"
        }
        onEdit={() => undefined}
        onCopy={() => undefined}
        onToggleEnabled={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: /delete upstream/i }),
    ).toBeDisabled();
  });

  it("disables copy for account-backed special upstream rows", () => {
    render(
      <UpstreamsTable
        upstreams={[buildUpstream()]}
        columns={UPSTREAM_COLUMNS}
        disableDelete={false}
        isCopyDisabled={(upstream) =>
          upstream.providers.length === 1 && upstream.providers[0] === "codex"
        }
        onEdit={() => undefined}
        onCopy={() => undefined}
        onToggleEnabled={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: /copy upstream/i }),
    ).toBeDisabled();
  });
});
