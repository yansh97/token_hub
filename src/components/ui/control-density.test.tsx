import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

afterEach(cleanup);

describe("ui/control-density", () => {
  it("uses the compact control and typography defaults", () => {
    render(
      <>
        <Button>保存</Button>
        <Label htmlFor="name">名称</Label>
        <Input id="name" />
        <PasswordInput aria-label="密钥" />
      </>,
    );

    expect(screen.getByRole("button", { name: "保存" })).toHaveClass(
      "h-8",
      "text-[13px]",
      "focus-visible:ring-2",
      "focus-visible:ring-ring/20",
    );
    expect(screen.getByLabelText("名称")).toHaveClass(
      "h-8",
      "text-[13px]",
      "focus-visible:ring-2",
      "focus-visible:ring-ring/20",
    );
    expect(screen.getByText("名称")).toHaveClass("text-[13px]");
    expect(screen.getByLabelText("密钥")).toHaveClass(
      "h-8",
      "text-[13px]",
      "focus-visible:ring-2",
      "focus-visible:ring-ring/20",
    );
    expect(screen.getByRole("button", { name: "显示" })).toHaveClass("size-8");
    expect(screen.getByRole("button", { name: "显示" })).not.toHaveAttribute(
      "tabindex",
      "-1",
    );
  });
});
