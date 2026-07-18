import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/layouts/app-sidebar";
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
  Link: ({
    to,
    children,
    ...props
  }: ComponentProps<"a"> & { to: string; children: ReactNode }) => (
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

  it("renders the Token Hub title", () => {
    setLocale("zh", { reload: false });

    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );

    expect(screen.getByRole("link", { name: "Token Hub" })).toBeInTheDocument();
  });
});
