import { cleanup, render, screen } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UpstreamEditorFields } from "@/features/config/cards/upstreams/editor-dialog-form";
import { createEmptyUpstream } from "@/features/config/form";
import { m } from "@/paraglide/messages.js";

afterEach(() => {
  cleanup();
  vi.mocked(invoke).mockReset();
});

describe("upstreams/editor-dialog-form", () => {
  it("shows connection, model access, and expanded advanced sections", () => {
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
      screen.getByText(m.upstreams_section_connection()),
    ).toBeInTheDocument();
    expect(screen.getByText(m.upstreams_section_models())).toBeInTheDocument();
    expect(
      screen.getByText(m.upstreams_section_advanced()),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(m.field_id())).toBeInTheDocument();
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

    await user.click(screen.getByText(m.available_models_selected()));

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
        name: m.available_models_remove({ model: "gpt-5.4" }),
      }),
    );

    expect(onChangeDraft).toHaveBeenCalledWith({ availableModels: [] });
  });

  it("selects every fetched model from an indeterminate state", async () => {
    const user = userEvent.setup();
    const draft = createEmptyUpstream();
    draft.availableModelsMode = "selected";
    draft.availableModels = ["gpt-5.4"];
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

    await user.click(
      screen.getByRole("button", { name: m.available_models_sync() }),
    );
    const selectAll = await screen.findByRole("checkbox", {
      name: m.available_models_select_all(),
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

    await user.type(
      screen.getByPlaceholderText(m.available_models_search_placeholder()),
      "gpt",
    );
    await user.click(
      screen.getByRole("checkbox", { name: m.available_models_clear_all() }),
    );

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

    expect(screen.queryByText(m.field_kiro_account())).not.toBeInTheDocument();
    expect(screen.queryByLabelText(m.field_base_url())).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(m.field_proxy_url()),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(m.field_id())).toBeDisabled();
    expect(screen.getByRole("button", { name: /kiro/i })).toBeDisabled();
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

    expect(screen.queryByText(m.field_codex_account())).not.toBeInTheDocument();
    expect(screen.queryByLabelText(m.field_base_url())).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(m.field_proxy_url()),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(m.field_id())).toBeDisabled();
    expect(screen.getByRole("button", { name: /codex/i })).toBeDisabled();
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

    expect(screen.queryByLabelText(m.field_base_url())).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(m.field_proxy_url()),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(m.field_api_key())).not.toBeInTheDocument();
    expect(screen.getByLabelText(m.field_id())).toBeEnabled();
    expect(screen.getByRole("button", { name: /antigravity/i })).toBeEnabled();
  });
});
