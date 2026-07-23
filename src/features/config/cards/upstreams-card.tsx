import { useCallback, useState } from "react";

import { UPSTREAM_COLUMNS } from "@/features/config/cards/upstreams/constants";
import { DeleteUpstreamDialog } from "@/features/config/cards/upstreams/delete-dialog";
import { UpstreamEditorDialog } from "@/features/config/cards/upstreams/editor-dialog";
import {
  UpstreamsTable,
  UpstreamsToolbar,
} from "@/features/config/cards/upstreams/table";
import type {
  DeleteDialogState,
  UpstreamEditorState,
} from "@/features/config/cards/upstreams/types";
import {
  cloneUpstreamDraft,
  createCopiedUpstreamId,
  normalizeProviders,
  providersEqual,
  pruneConvertFromMap,
} from "@/features/config/cards/upstreams/upstream-editor-helpers";
import {
  createEmptyUpstream,
  validateUpstreamDraft,
} from "@/features/config/form";
import type { UpstreamForm } from "@/features/config/types";

type UpstreamsCardProps = {
  upstreams: UpstreamForm[];
  showApiKeys: boolean;
  providerOptions: string[];
  appProxyUrl: string;
  onToggleApiKeys: () => void;
  onAdd: (upstream: UpstreamForm) => void;
  onRemove: (index: number) => void;
  onChange: (index: number, patch: Partial<UpstreamForm>) => void;
};

export function UpstreamsCard({
  upstreams,
  showApiKeys,
  providerOptions,
  appProxyUrl,
  onToggleApiKeys,
  onAdd,
  onRemove,
  onChange,
}: UpstreamsCardProps) {
  const [editor, setEditor] = useState<UpstreamEditorState>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
  });
  const [editorTouchedFields, setEditorTouchedFields] = useState<Set<string>>(
    () => new Set(),
  );
  const [editorSubmitted, setEditorSubmitted] = useState(false);
  const touchEditorField = useCallback((field: string) => {
    setEditorTouchedFields((current) => {
      if (current.has(field)) {
        return current;
      }
      const next = new Set(current);
      next.add(field);
      return next;
    });
  }, []);
  const columns = UPSTREAM_COLUMNS;
  // 更新 draft，并在 provider 变化时清理不再适用的字段。
  const updateDraft = useCallback((patch: Partial<UpstreamForm>) => {
    setEditorTouchedFields((current) => {
      const next = new Set(current);
      for (const field of Object.keys(patch)) {
        if (field === "availableModelsMode" || field === "availableModels") {
          next.add("availableModels");
        } else if (field === "overrides") {
          next.add("headerOverrides");
        } else {
          next.add(field);
        }
      }
      return next;
    });
    setEditor((prev) => {
      if (!prev.open) return prev;

      const currentProviders = normalizeProviders(prev.draft.providers);
      const nextProviders =
        patch.providers === undefined
          ? currentProviders
          : normalizeProviders(patch.providers);
      const providersChanged =
        patch.providers !== undefined &&
        !providersEqual(nextProviders, currentProviders);

      // 如果 provider 变化，清理不再适用的 provider 专属字段。
      if (providersChanged) {
        // openai-response 专属开关：切换到其它 provider 时清零，避免把无效字段写进配置。
        let filterPromptCacheRetention = prev.draft.filterPromptCacheRetention;
        let filterSafetyIdentifier = prev.draft.filterSafetyIdentifier;
        let useChatCompletionsForResponses =
          prev.draft.useChatCompletionsForResponses;
        let rewriteDeveloperRoleToSystem =
          prev.draft.rewriteDeveloperRoleToSystem;
        const baseUrl = patch.baseUrl ?? prev.draft.baseUrl;
        const proxyUrl = patch.proxyUrl ?? prev.draft.proxyUrl;
        let convertFromMap = patch.convertFromMap ?? prev.draft.convertFromMap;

        if (!nextProviders.includes("openai-response")) {
          filterPromptCacheRetention = false;
          filterSafetyIdentifier = false;
          useChatCompletionsForResponses = false;
        }
        if (
          !nextProviders.some(
            (provider) =>
              provider === "openai" || provider === "openai-response",
          )
        ) {
          rewriteDeveloperRoleToSystem = false;
        }
        if (patch.filterPromptCacheRetention !== undefined) {
          filterPromptCacheRetention = patch.filterPromptCacheRetention;
        }
        if (patch.filterSafetyIdentifier !== undefined) {
          filterSafetyIdentifier = patch.filterSafetyIdentifier;
        }
        if (patch.useChatCompletionsForResponses !== undefined) {
          useChatCompletionsForResponses = patch.useChatCompletionsForResponses;
        }
        if (patch.rewriteDeveloperRoleToSystem !== undefined) {
          rewriteDeveloperRoleToSystem = patch.rewriteDeveloperRoleToSystem;
        }

        convertFromMap = pruneConvertFromMap(convertFromMap, nextProviders);

        return {
          ...prev,
          draft: {
            ...prev.draft,
            ...patch,
            providers: nextProviders,
            baseUrl,
            filterPromptCacheRetention,
            filterSafetyIdentifier,
            useChatCompletionsForResponses,
            rewriteDeveloperRoleToSystem,
            proxyUrl,
            convertFromMap,
          },
        };
      }
      return { ...prev, draft: { ...prev.draft, ...patch } };
    });
  }, []);

  const openCreateDialog = () => {
    const draft = createEmptyUpstream();
    const nextProviders = normalizeProviders(draft.providers);
    setEditor({
      open: true,
      mode: "create",
      draft: { ...draft, providers: nextProviders },
    });
    setEditorTouchedFields(new Set());
    setEditorSubmitted(false);
  };

  const openEditDialog = (index: number) => {
    const upstream = upstreams[index];
    if (!upstream) {
      return;
    }
    setEditor({
      open: true,
      mode: "edit",
      index,
      draft: cloneUpstreamDraft(upstream),
    });
    setEditorTouchedFields(new Set());
    setEditorSubmitted(false);
  };

  const openCopyDialog = (index: number) => {
    const upstream = upstreams[index];
    if (!upstream) {
      return;
    }
    const nextId = createCopiedUpstreamId(upstream.id, upstreams);
    const draft: UpstreamForm = {
      ...cloneUpstreamDraft(upstream),
      id: nextId,
    };
    setEditor({ open: true, mode: "create", draft });
    setEditorTouchedFields(new Set());
    setEditorSubmitted(false);
  };

  const editorValidation = editor.open
    ? validateUpstreamDraft({
        draft: editor.draft,
        upstreams,
        index: editor.mode === "edit" ? editor.index : null,
        appProxyUrl,
      })
    : null;
  const visibleEditorErrors = Object.fromEntries(
    Object.entries(editorValidation?.errors ?? {}).filter(([field]) => {
      const rootField = field.split(".")[0] ?? field;
      return editorSubmitted || editorTouchedFields.has(rootField);
    }),
  );

  const saveDraft = () => {
    if (!editor.open) {
      return;
    }
    if (!editorValidation?.valid) {
      setEditorSubmitted(true);
      return;
    }

    if (editor.mode === "create") {
      onAdd(editor.draft);
    } else {
      onChange(editor.index, editor.draft);
    }
    setEditor({ open: false });
  };

  const confirmDelete = () => {
    if (!deleteDialog.open) {
      return;
    }
    onRemove(deleteDialog.index);
    setDeleteDialog({ open: false });
  };

  return (
    <section
      data-slot="upstreams-card"
      className="flex max-h-full min-h-0 flex-1 flex-col"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-border/70 pb-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[15px] font-semibold leading-5">提供商</h2>
            <span className="text-[12px] text-muted-foreground">
              {upstreams.length} 个
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
            管理请求转发目标、协议、优先级和可用状态。
          </p>
        </div>
        <div className="ml-auto shrink-0">
          <UpstreamsToolbar onAddClick={openCreateDialog} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col pt-4">
        {upstreams.length ? (
          <UpstreamsTable
            upstreams={upstreams}
            columns={columns}
            disableDelete={false}
            onEdit={openEditDialog}
            onCopy={openCopyDialog}
            onToggleEnabled={(index) => {
              const upstream = upstreams[index];
              if (!upstream) {
                return;
              }
              onChange(index, { enabled: !upstream.enabled });
            }}
            onDelete={(index) => setDeleteDialog({ open: true, index })}
          />
        ) : (
          <div className="flex min-h-48 flex-1 items-center justify-center rounded-md border border-dashed border-border/80">
            <div className="text-center">
              <p className="text-[13px] font-medium">尚未添加提供商</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                添加一个提供商后即可开始转发请求。
              </p>
            </div>
          </div>
        )}
      </div>

      <UpstreamEditorDialog
        editor={editor}
        errors={visibleEditorErrors}
        providerOptions={providerOptions}
        showApiKeys={showApiKeys}
        onToggleApiKeys={onToggleApiKeys}
        onOpenChange={(open) => {
          if (!open) {
            setEditor({ open: false });
            setEditorTouchedFields(new Set());
            setEditorSubmitted(false);
          }
        }}
        onChangeDraft={updateDraft}
        onFieldBlur={touchEditorField}
        onSave={saveDraft}
      />
      <DeleteUpstreamDialog
        dialog={deleteDialog}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false })}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
