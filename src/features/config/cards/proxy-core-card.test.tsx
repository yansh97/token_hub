import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProxyCoreCard } from "@/features/config/cards/proxy-core-card";
import { EMPTY_FORM } from "@/features/config/form";

afterEach(() => {
  cleanup();
});

describe("ProxyCoreCard", () => {
  it("marks field requirements and exposes field-level validation errors", () => {
    render(
      <ProxyCoreCard
        form={{ ...EMPTY_FORM, host: "", port: "9208x" }}
        showLocalKey={false}
        onToggleLocalKey={() => undefined}
        onChange={() => undefined}
        proxyService={{
          status: { state: "stopped", addr: null, last_error: null },
          requestState: "idle",
          message: "",
          isDirty: false,
          onRefresh: () => undefined,
          onStart: () => undefined,
          onStop: () => undefined,
          onRestart: () => undefined,
          onReload: () => undefined,
        }}
      />,
    );

    expect(screen.getByLabelText("监听地址")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("端口")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("监听地址不能为空。")).toBeInTheDocument();
    expect(
      screen.getByText("端口必须是 1 到 65535 之间的整数。"),
    ).toBeInTheDocument();
  });
});
