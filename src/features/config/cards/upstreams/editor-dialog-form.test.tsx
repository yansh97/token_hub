import { invoke } from "@tauri-apps/api/core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UpstreamEditorFields } from "@/features/config/cards/upstreams/editor-dialog-form";
import { createEmptyUpstream } from "@/features/config/form";

afterEach(() => {
  cleanup();
  vi.mocked(invoke).mockReset();
});

describe("upstreams/editor-dialog-form", () => {
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
    await user.type(searchInput, "gpt");
    await user.click(screen.getByRole("checkbox", { name: "取消全选" }));

    expect(onChangeDraft).toHaveBeenCalledWith({
      availableModels: ["claude-sonnet-4.6"],
    });
  });
});
