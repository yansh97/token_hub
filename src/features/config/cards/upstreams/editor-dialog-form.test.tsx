import { cleanup, render, screen } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UpstreamEditorFields } from "@/features/config/cards/upstreams/editor-dialog-form";
import { createEmptyUpstream } from "@/features/config/form";

afterEach(() => {
  cleanup();
  vi.mocked(invoke).mockReset();
});

describe("upstreams/editor-dialog-form", () => {
  it("shows connection, model access, and advanced settings without a disclosure", () => {
    const draft = createEmptyUpstream();

    render(
      <UpstreamEditorFields
        draft={draft}
        providerOptions={["openai"]}
        showApiKeys={false}
        onToggleApiKeys={vi.fn()}
        onChangeDraft={vi.fn()}
      />,
    );

    expect(screen.getByText("连接")).toBeInTheDocument();
    expect(screen.getByText("模型访问")).toBeInTheDocument();
    const connectionSection = screen.getByText("连接").closest("section");
    const idInput = screen.getByLabelText("ID");
    const apiKeysInput = screen.getByLabelText("API Keys");
    const priorityInput = screen.getByLabelText("优先级");
    const advancedSettings = screen.getByText("高级设置").closest("section");
    const providerSelect = document.querySelector(
      '[data-slot="provider-multi-select"]',
    );
    const compatibilityFields = document.querySelector(
      '[data-slot="upstream-compatibility-fields"]',
    );

    expect(connectionSection).toContainElement(idInput);
    expect(connectionSection).toContainElement(priorityInput);
    expect(providerSelect).toHaveClass("sm:grid-cols-[1fr_1.25fr_1fr_1fr]");
    expect(idInput).toHaveAttribute("placeholder", "openai");
    expect(apiKeysInput).toHaveAttribute("placeholder", "sk-xxxxxxxxxxxx");
    expect(advancedSettings).not.toBeNull();
    expect(screen.getByText("高级设置").closest("details")).toBeNull();
    expect(priorityInput).toHaveValue("100");
    expect(priorityInput).toBeRequired();
    expect(compatibilityFields).toHaveClass("border-t");
    expect(compatibilityFields).not.toHaveClass("border-y");
    expect(compatibilityFields?.lastElementChild).toHaveClass("last:pb-0");
  });

  it("renders inline help only for advanced settings", () => {
    const draft = createEmptyUpstream();

    render(
      <UpstreamEditorFields
        draft={draft}
        providerOptions={["openai"]}
        showApiKeys={false}
        onToggleApiKeys={vi.fn()}
        onChangeDraft={vi.fn()}
      />,
    );

    expect(
      screen.queryByText("提供商的 API 根地址，启用前必须填写。"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "多个密钥使用逗号分隔；留空时沿用入站请求的鉴权信息。",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("整数，数值越大优先级越高；相同优先级按列表顺序选择。"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("调整路由优先级、格式转换和请求兼容行为。"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("aligns mapping and header editors in the advanced value column", () => {
    const draft = createEmptyUpstream();
    draft.modelMappings = [
      { id: "mapping-1", pattern: "gpt-4*", target: "gpt-4.1" },
    ];
    draft.overrides.header = [
      { id: "header-1", name: "x-client", value: "token-hub", isNull: false },
    ];

    render(
      <UpstreamEditorFields
        draft={draft}
        providerOptions={["openai"]}
        showApiKeys={false}
        onToggleApiKeys={vi.fn()}
        onChangeDraft={vi.fn()}
      />,
    );

    expect(
      document.querySelector('[data-slot="upstream-model-mapping-fields"]'),
    ).toHaveClass("contents");
    expect(
      document.querySelector('[data-slot="upstream-header-override-fields"]'),
    ).toHaveClass("contents");
    expect(screen.getByRole("switch", { name: "停用请求头" })).toBeChecked();
  });

  it("switches from all models to selected-model mode", async () => {
    const user = userEvent.setup();
    const draft = createEmptyUpstream();
    const onChangeDraft = vi.fn();

    render(
      <UpstreamEditorFields
        draft={draft}
        providerOptions={["openai"]}
        showApiKeys={false}
        onToggleApiKeys={vi.fn()}
        onChangeDraft={onChangeDraft}
      />,
    );

    await user.click(screen.getByText("仅指定模型"));

    expect(onChangeDraft).toHaveBeenCalledWith({
      availableModelsMode: "selected",
    });
  });

  it("removes a selected model from the allowlist", async () => {
    const user = userEvent.setup();
    const draft = createEmptyUpstream();
    draft.availableModelsMode = "selected";
    draft.availableModels = ["gpt-5.4"];
    const onChangeDraft = vi.fn();

    render(
      <UpstreamEditorFields
        draft={draft}
        providerOptions={["openai"]}
        showApiKeys={false}
        onToggleApiKeys={vi.fn()}
        onChangeDraft={onChangeDraft}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "移除模型 gpt-5.4",
      }),
    );

    expect(onChangeDraft).toHaveBeenCalledWith({ availableModels: [] });
  });

  it("selects every fetched model from an indeterminate state", async () => {
    const user = userEvent.setup();
    const draft = createEmptyUpstream();
    draft.availableModelsMode = "selected";
    draft.availableModels = ["gpt-5.4"];
    draft.baseUrl = "https://example.com";
    const onChangeDraft = vi.fn();
    vi.mocked(invoke).mockResolvedValue([
      "gpt-5.5",
      "claude-sonnet-4.6",
      "gpt-5.4",
    ]);

    render(
      <UpstreamEditorFields
        draft={draft}
        providerOptions={["openai"]}
        showApiKeys={false}
        onToggleApiKeys={vi.fn()}
        onChangeDraft={onChangeDraft}
      />,
    );

    await user.click(screen.getByRole("button", { name: "从提供商获取模型" }));
    const selectAll = await screen.findByRole("checkbox", {
      name: "全选",
    });

    expect(selectAll).toHaveAttribute("data-state", "indeterminate");
    await user.click(selectAll);

    expect(onChangeDraft).toHaveBeenCalledWith({
      availableModels: ["claude-sonnet-4.6", "gpt-5.4", "gpt-5.5"],
    });
  });

  it("clears only the models visible in the current search", async () => {
    const user = userEvent.setup();
    const draft = createEmptyUpstream();
    draft.availableModelsMode = "selected";
    draft.availableModels = ["claude-sonnet-4.6", "gpt-5.4"];
    const onChangeDraft = vi.fn();

    render(
      <UpstreamEditorFields
        draft={draft}
        providerOptions={["openai"]}
        showApiKeys={false}
        onToggleApiKeys={vi.fn()}
        onChangeDraft={onChangeDraft}
      />,
    );

    const searchInput = screen.getByPlaceholderText("搜索已获取的模型");
    expect(searchInput).toHaveClass("pl-9!");
    await user.type(searchInput, "gpt");
    await user.click(screen.getByRole("checkbox", { name: "取消全选" }));

    expect(onChangeDraft).toHaveBeenCalledWith({
      availableModels: ["claude-sonnet-4.6"],
    });
  });

  it("renders kiro account selector when provider is kiro", () => {
    const draft = createEmptyUpstream();
    draft.id = "kiro-default";
    draft.providers = ["kiro"];

    render(
      <UpstreamEditorFields
        draft={draft}
        providerOptions={["kiro"]}
        showApiKeys={false}
        onToggleApiKeys={vi.fn()}
        onChangeDraft={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("combobox", { name: "Kiro 账户" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Base URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("代理 URL")).not.toBeInTheDocument();
    expect(screen.getByLabelText("ID")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Kiro 账户" })).toBeDisabled();
  });

  it("renders codex account selector when provider is codex", () => {
    const draft = createEmptyUpstream();
    draft.id = "codex-default";
    draft.providers = ["codex"];

    render(
      <UpstreamEditorFields
        draft={draft}
        providerOptions={["codex"]}
        showApiKeys={false}
        onToggleApiKeys={vi.fn()}
        onChangeDraft={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("combobox", { name: "Codex 账户" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Base URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("代理 URL")).not.toBeInTheDocument();
    expect(screen.getByLabelText("ID")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Codex 账户" })).toBeDisabled();
  });

  it("hides network and api key fields when provider is antigravity", () => {
    const draft = createEmptyUpstream();
    draft.id = "antigravity-default";
    draft.providers = ["antigravity"];

    render(
      <UpstreamEditorFields
        draft={draft}
        providerOptions={["antigravity"]}
        showApiKeys={false}
        onToggleApiKeys={vi.fn()}
        onChangeDraft={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Base URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("代理 URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("API Keys")).not.toBeInTheDocument();
    expect(screen.getByLabelText("ID")).toBeEnabled();
    expect(screen.getByRole("button", { name: /antigravity/i })).toBeEnabled();
  });
});
