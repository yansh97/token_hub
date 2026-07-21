import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppSidebar } from "@/layouts/app-sidebar";

describe("layouts/AppSidebar", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "#/dashboard");
  });

  it("renders the Token Hub title", () => {
    window.history.replaceState(null, "", "#/dashboard");

    render(<AppSidebar />);

    const title = screen.getByRole("link", { name: "Token Hub" });
    const sidebar = title.closest("aside");
    expect(title).toHaveClass("text-[15px]");
    expect(title.parentElement).toHaveClass("h-12");
    expect(title.parentElement).not.toHaveClass("border-b");
    expect(sidebar).toHaveClass(
      "w-44",
      "border-sidebar-border",
      "bg-sidebar",
      "text-sidebar-foreground",
    );
    expect(screen.getByRole("link", { name: "仪表盘" })).toHaveClass(
      "text-[14px]",
    );
    expect(screen.getByRole("link", { name: "仪表盘" })).toHaveAttribute(
      "href",
      "#/dashboard",
    );
  });
});
