import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UpstreamsCard } from "@/features/config/cards/upstreams-card";

afterEach(() => {
  cleanup();
});

describe("config/upstreams-card", () => {
  it("keeps the entered id when interface formats change", async () => {
    const user = userEvent.setup();

    render(
      <UpstreamsCard
        upstreams={[]}
        showApiKeys={false}
        providerOptions={["openai", "openai-response", "anthropic", "gemini"]}
        appProxyUrl=""
        onToggleApiKeys={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "添加提供商" }));
    const idInput = screen.getByLabelText("ID");
    await user.type(idInput, "custom-id");
    await user.click(screen.getByRole("button", { name: "Gemini" }));

    expect(idInput).toHaveValue("custom-id");
  });

  it("keeps an invalid provider editor open and validates fields in real time", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(
      <UpstreamsCard
        upstreams={[]}
        showApiKeys={false}
        providerOptions={[]}
        appProxyUrl=""
        onToggleApiKeys={vi.fn()}
        onAdd={onAdd}
        onRemove={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "添加提供商" }));
    const idInput = screen.getByLabelText("ID");
    fireEvent.blur(idInput);
    expect(screen.getByText("提供商 ID 不能为空。")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "仅指定模型" }));
    expect(screen.getByText("请至少添加一个可用模型。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "全部模型" }));

    await user.click(screen.getByRole("button", { name: "添加映射" }));
    expect(
      screen.getByText("第 1 行映射的匹配模式不能为空。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("第 1 行映射的目标模型不能为空。"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "删除映射" }));

    await user.click(screen.getByRole("button", { name: "添加请求头" }));
    expect(
      screen.getByText("第 1 行的请求头名称不能为空。"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "删除Header" }));

    const priorityInput = screen.getByLabelText("优先级");
    fireEvent.change(priorityInput, { target: { value: "" } });
    expect(screen.getByText("优先级不能为空。")).toBeInTheDocument();
    fireEvent.change(priorityInput, { target: { value: "100" } });

    const baseUrlInput = screen.getByLabelText("Base URL");
    fireEvent.change(baseUrlInput, { target: { value: "invalid" } });

    expect(
      screen.getByText("请输入有效的 HTTP 或 HTTPS URL。"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("提供商 ID 不能为空。")).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.change(idInput, { target: { value: "openai" } });
    fireEvent.change(baseUrlInput, {
      target: { value: "https://api.openai.com" },
    });
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
