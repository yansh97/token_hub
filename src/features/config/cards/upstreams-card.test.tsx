import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UpstreamsCard } from "@/features/config/cards/upstreams-card";
import { m } from "@/paraglide/messages.js";

afterEach(() => {
  cleanup();
});

describe("config/upstreams-card", () => {
  it("places the title and add action in the card header", () => {
    render(
      <UpstreamsCard
        upstreams={[]}
        showApiKeys={false}
        providerOptions={[]}
        onToggleApiKeys={() => undefined}
        onAdd={() => undefined}
        onRemove={() => undefined}
        onChange={() => undefined}
      />,
    );

    const title = screen.getByText(m.upstreams_title());
    const addButton = screen.getByRole("button", { name: m.upstreams_add() });
    const header = title.closest('[data-slot="card-header"]');

    expect(header).not.toBeNull();
    expect(header).toContainElement(addButton);
    expect(addButton.closest('[data-slot="card-action"]')).not.toBeNull();
  });
});
