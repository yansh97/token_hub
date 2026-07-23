import { invoke } from "@tauri-apps/api/core";
import { Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field-meta";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { UpstreamForm } from "@/features/config/types";

type AvailableModelsEditorProps = {
  draft: UpstreamForm;
  error?: string;
  onChangeDraft: (patch: Partial<UpstreamForm>) => void;
};

function mergeModels(...groups: readonly (readonly string[])[]) {
  const models = new Set<string>();
  for (const group of groups) {
    for (const value of group) {
      const model = value.trim();
      if (model) {
        models.add(model);
      }
    }
  }
  return [...models].sort();
}

function firstApiKey(value: string) {
  return (
    value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .find(Boolean) ?? ""
  );
}

export function AvailableModelsEditor({
  draft,
  error,
  onChangeDraft,
}: AvailableModelsEditorProps) {
  const [options, setOptions] = useState(() =>
    mergeModels(draft.availableModels),
  );
  const [search, setSearch] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [fetching, setFetching] = useState(false);
  const [feedback, setFeedback] = useState("");
  const provider = draft.providers[0]?.trim() ?? "";
  const canFetch =
    ["openai", "openai-response", "anthropic", "gemini"].includes(provider) &&
    !!draft.baseUrl.trim();
  const selectedModels = mergeModels(draft.availableModels);
  const selectedModelSet = new Set(selectedModels);
  const visibleOptions = mergeModels(options, selectedModels).filter((model) =>
    model.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const visibleSelectedCount = visibleOptions.filter((model) =>
    selectedModelSet.has(model),
  ).length;
  const allVisibleModelsSelected =
    visibleOptions.length > 0 && visibleSelectedCount === visibleOptions.length;
  const visibleModelsSelection = allVisibleModelsSelected
    ? true
    : visibleSelectedCount > 0
      ? "indeterminate"
      : false;
  const visibleModelsBulkLabel = allVisibleModelsSelected ? "取消全选" : "全选";

  const updateSelectedModels = (models: readonly string[]) => {
    onChangeDraft({ availableModels: mergeModels(models) });
  };

  const toggleModel = (model: string, checked: boolean) => {
    if (checked) {
      updateSelectedModels([...selectedModels, model]);
      return;
    }
    updateSelectedModels(
      selectedModels.filter((candidate) => candidate !== model),
    );
  };

  const toggleVisibleModels = () => {
    if (!visibleOptions.length) {
      return;
    }
    if (allVisibleModelsSelected) {
      const visibleModelSet = new Set(visibleOptions);
      updateSelectedModels(
        selectedModels.filter((model) => !visibleModelSet.has(model)),
      );
      return;
    }
    updateSelectedModels([...selectedModels, ...visibleOptions]);
  };

  const addCustomModel = () => {
    const model = customModel.trim();
    if (!model) {
      return;
    }
    // 手工模型同时进入候选与已选集合，避免用户还要再勾选一次。
    setOptions((current) => mergeModels(current, [model]));
    updateSelectedModels([...selectedModels, model]);
    setCustomModel("");
    setFeedback("");
  };

  const fetchModels = async () => {
    if (!draft.baseUrl.trim()) {
      setFeedback("请先填写 Base URL。");
      return;
    }
    setFetching(true);
    setFeedback("");
    try {
      const models = await invoke<string[]>("fetch_upstream_models", {
        provider,
        baseUrl: draft.baseUrl.trim(),
        apiKey: firstApiKey(draft.apiKeys),
      });
      if (!models.length) {
        setFeedback("提供商未返回可用模型。");
        return;
      }
      setOptions((current) => mergeModels(current, models));
      setFeedback(`已获取 ${models.length} 个模型，可勾选后加入白名单。`);
      console.info("[upstream-models] fetched model candidates", {
        provider,
        count: models.length,
      });
    } catch (error) {
      console.error("[upstream-models] failed to fetch model candidates", {
        provider,
        error,
      });
      setFeedback(String(error));
    } finally {
      setFetching(false);
    }
  };

  return (
    <div data-slot="available-models-editor" className="space-y-3">
      <ToggleGroup
        type="single"
        variant="outline"
        value={draft.availableModelsMode}
        onValueChange={(value) => {
          if (value === "all" || value === "selected") {
            onChangeDraft({ availableModelsMode: value });
          }
        }}
        aria-label={"可用模型"}
        aria-invalid={Boolean(error)}
      >
        <ToggleGroupItem
          value="all"
          className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {"全部模型"}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="selected"
          className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {"仅指定模型"}
        </ToggleGroupItem>
      </ToggleGroup>
      <FieldError message={error} />

      {draft.availableModelsMode === "all" ? null : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted-foreground">
              已选择 {selectedModels.length} 个模型
            </span>
            {selectedModels.map((model) => (
              <Badge key={model} variant="secondary" className="gap-1 pr-1">
                <span className="max-w-48 truncate">{model}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-5 rounded-full"
                  aria-label={`移除模型 ${model}`}
                  onClick={() => toggleModel(model, false)}
                >
                  <X className="size-3" aria-hidden="true" />
                </Button>
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={"搜索已获取的模型"}
                className="pl-9!"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={"从提供商获取模型"}
              title={"从提供商获取模型"}
              disabled={!canFetch || fetching}
              onClick={fetchModels}
            >
              {fetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>

          {feedback ? (
            <p className="text-xs text-muted-foreground">{feedback}</p>
          ) : null}

          <ScrollArea className="h-40 rounded-md border">
            <div className="divide-y">
              {visibleOptions.length ? (
                <>
                  <div className="sticky top-0 z-10 flex min-h-8 items-center gap-2.5 bg-muted px-3 py-1.5">
                    <Checkbox
                      id="available-models-select-all"
                      checked={visibleModelsSelection}
                      onCheckedChange={toggleVisibleModels}
                      aria-label={visibleModelsBulkLabel}
                    />
                    <Label
                      htmlFor="available-models-select-all"
                      className="cursor-pointer text-[12px] font-medium"
                    >
                      {visibleModelsBulkLabel}
                    </Label>
                  </div>
                  {visibleOptions.map((model, index) => {
                    const checkboxId = `available-model-${index}`;
                    return (
                      <div
                        key={model}
                        className="flex min-h-8 items-center gap-2.5 px-3 py-1.5 hover:bg-muted/50"
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={selectedModelSet.has(model)}
                          onCheckedChange={(value) =>
                            toggleModel(model, value === true)
                          }
                        />
                        <Label
                          htmlFor={checkboxId}
                          className="min-w-0 flex-1 cursor-pointer truncate font-mono text-[12px] font-normal"
                        >
                          {model}
                        </Label>
                      </div>
                    );
                  })}
                </>
              ) : (
                <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                  {options.length
                    ? "没有匹配的模型。"
                    : "暂无候选模型，可从提供商获取或手工添加。"}
                </p>
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center gap-2">
            <Input
              value={customModel}
              onChange={(event) => setCustomModel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomModel();
                }
              }}
              placeholder={"输入自定义模型名称"}
            />
            <Button type="button" variant="outline" onClick={addCustomModel}>
              <Plus className="size-4" aria-hidden="true" />
              {"添加模型"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
