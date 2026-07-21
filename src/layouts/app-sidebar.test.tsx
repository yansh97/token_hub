import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar, SIDEBAR_ACTIVE_LAYOUT_ID } from "@/layouts/app-sidebar";
import { m } from "@/paraglide/messages.js";
import { setLocale } from "@/paraglide/runtime.js";

const routerState = vi.hoisted(() => ({
  pathname: "/config/dashboard",
}));

type RouterState = {
  location: {
    pathname: string;
  };
};

type UseRouterStateArgs<T> = {
  select?: (state: RouterState) => T;
};

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: ComponentProps<"a"> & { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: <T,>({ select }: UseRouterStateArgs<T>) => {
    const state: RouterState = { location: { pathname: routerState.pathname } };
    return select ? select(state) : state;
  },
}));

describe("layouts/AppSidebar", () => {
  afterEach(() => {
    cleanup();
    setLocale("en", { reload: false });
    routerState.pathname = "/config/dashboard";
  });

  it("localizes the Agent Node menu item", () => {
    setLocale("zh", { reload: false });
    routerState.pathname = "/agent-node";

    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    );

    expect(screen.getByRole("link", { name: m.agent_node_title({}, { locale: "zh" }) })).toHaveAttribute(
      "href",
      "/agent-node"
    );
    expect(screen.queryByText("Agent Node")).not.toBeInTheDocument();
  });

  it("marks the active route and renders the motion layout indicator", () => {
    routerState.pathname = "/agent-node";

    const { container } = render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    );

    const agentLink = screen.getByRole("link", { name: m.agent_node_title() });
    expect(agentLink).toHaveAttribute("data-active", "true");

    const indicator = container.querySelector('[data-slot="sidebar-active-indicator"]');
    expect(indicator).not.toBeNull();
    // motion 会把 layoutId 落到 DOM；常量导出便于回归 layout 契约
    expect(SIDEBAR_ACTIVE_LAYOUT_ID).toBe("sidebar-nav-active");
  });
});
