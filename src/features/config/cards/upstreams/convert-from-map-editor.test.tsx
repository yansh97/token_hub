import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConvertFromMapEditor } from "@/features/config/cards/upstreams/convert-from-map-editor";

afterEach(cleanup);

describe("upstreams/convert-from-map-editor", () => {
  it("adds a format conversion", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ConvertFromMapEditor
        providers={["openai-response", "anthropic"]}
        value={{}}
        onChange={onChange}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", {
        name: "允许 OpenAI 转换为 Anthropic",
      }),
    );

    expect(onChange).toHaveBeenCalledWith({
      anthropic: ["openai_chat"],
    });
  });

  it("shows no conversion options when every format is native", () => {
    render(
      <ConvertFromMapEditor
        providers={["openai", "openai-response", "anthropic", "gemini"]}
        value={{}}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("无可用选项")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("can remove an existing conversion", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ConvertFromMapEditor
        providers={["openai-response", "anthropic"]}
        value={{ anthropic: ["openai_chat"] }}
        onChange={onChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: "允许 OpenAI 转换为 Anthropic",
    });
    expect(checkbox).toBeChecked();
    await user.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({});
  });
});
