import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/layouts/app-shell";

vi.mock("@/layouts/app-sidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar" />,
}));

afterEach(() => {
  cleanup();
});

describe("layouts/AppShell", () => {
  it("uses page scrolling for document content", () => {
    const { container } = render(<AppShell>内容</AppShell>);

    const viewport = container.querySelector(
      '[data-slot="app-shell-viewport"]',
    );
    const content = container.querySelector('[data-slot="app-shell-content"]');
    expect(viewport).toHaveAttribute("data-content-mode", "document");
    expect(viewport).toHaveClass("overflow-y-auto");
    expect(content).toHaveClass("min-h-full");
  });

  it("keeps workspace scrolling inside its child content", () => {
    const { container } = render(
      <AppShell contentMode="workspace">内容</AppShell>,
    );

    const viewport = container.querySelector(
      '[data-slot="app-shell-viewport"]',
    );
    const content = container.querySelector('[data-slot="app-shell-content"]');
    expect(viewport).toHaveAttribute("data-content-mode", "workspace");
    expect(viewport).toHaveClass("overflow-hidden");
    expect(content).toHaveClass("h-full", "min-h-0");
  });
});
