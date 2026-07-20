import { useCallback, useMemo, useState } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  mergeProviderOptions,
  UPSTREAM_COLUMNS,
} from "@/features/config/cards/upstreams/constants";
import {
  cloneUpstreamDraft,
  coerceProviderSelection,
  createCopiedUpstreamId,
  isAccountBackedProviderSet,
  normalizeProviders,
  pruneConvertFromMap,
  providersEqual,
  resolveUpstreamIdForProviderChange,
} from "@/features/config/cards/upstreams/upstream-editor-helpers";
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
import { createEmptyUpstream } from "@/features/config/form";
import type { UpstreamForm } from "@/features/config/types";
import { m } from "@/paraglide/messages.js";

type UpstreamsCardProps = {
  upstreams: UpstreamForm[];
  showApiKeys: boolean;
  providerOptions: string[];
  onToggleApiKeys: () => void;
  onAdd: (upstream: UpstreamForm) => void;
  onRemove: (index: number) => void;
  onChange: (index: number, patch: Partial<UpstreamForm>) => void;
};

export function UpstreamsCard({
  upstreams,
  showApiKeys,
  providerOptions,
  onToggleApiKeys,
  onAdd,
  onRemove,
  onChange,
}: UpstreamsCardProps) {
  const mergedProviderOptions = useMemo(
    () => mergeProviderOptions(providerOptions),
    [providerOptions],
  );
  const [editor, setEditor] = useState<UpstreamEditorState>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
  });
  const columns = UPSTREAM_COLUMNS;
  const isSpecialAccountBackedUpstream = useCallback(
    (upstream: UpstreamForm) => {
      const providers = normalizeProviders(upstream.providers);
      return isAccountBackedProviderSet(providers);
    },
    [],
  );

  // 更新 draft，处理 provider 变化时的自动逻辑
  const updateDraft = useCallback(
    (patch: Partial<UpstreamForm>) => {
      setEditor((prev) => {
        if (!prev.open) return prev;

        const editingIndex = prev.mode === "edit" ? prev.index : undefined;
        const currentProviders = normalizeProviders(prev.draft.providers);
        const nextProviders =
          patch.providers === undefined
            ? currentProviders
            : coerceProviderSelection(patch.providers);
        const providersChanged =
          patch.providers !== undefined &&
          !providersEqual(nextProviders, currentProviders);

        // 如果 provider 变化，处理 ID / provider 专属字段的自动逻辑：
        // - 新增：根据 provider 自动生成 ID
        // - 编辑：保持现有 ID，避免统计/引用被拆分
        if (providersChanged) {
          // openai-response 专属开关：切换到其它 provider 时清零，避免把无效字段写进配置。
          let filterPromptCacheRetention =
            prev.draft.filterPromptCacheRetention;
          let filterSafetyIdentifier = prev.draft.filterSafetyIdentifier;
          let useChatCompletionsForResponses =
            prev.draft.useChatCompletionsForResponses;
          let rewriteDeveloperRoleToSystem =
            prev.draft.rewriteDeveloperRoleToSystem;
          let baseUrl = patch.baseUrl ?? prev.draft.baseUrl;
          let proxyUrl = patch.proxyUrl ?? prev.draft.proxyUrl;
          let convertFromMap =
            patch.convertFromMap ?? prev.draft.convertFromMap;

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
          if (isAccountBackedProviderSet(nextProviders)) {
            baseUrl = "";
            proxyUrl = "";
            patch.apiKeys = "";
          }
          if (patch.filterPromptCacheRetention !== undefined) {
            filterPromptCacheRetention = patch.filterPromptCacheRetention;
          }
          if (patch.filterSafetyIdentifier !== undefined) {
            filterSafetyIdentifier = patch.filterSafetyIdentifier;
          }
          if (patch.useChatCompletionsForResponses !== undefined) {
            useChatCompletionsForResponses =
              patch.useChatCompletionsForResponses;
          }
          if (patch.rewriteDeveloperRoleToSystem !== undefined) {
            rewriteDeveloperRoleToSystem = patch.rewriteDeveloperRoleToSystem;
          }

          convertFromMap = pruneConvertFromMap(convertFromMap, nextProviders);

          const id = resolveUpstreamIdForProviderChange({
            mode: prev.mode,
            currentId: prev.draft.id,
            currentProviders,
            nextProviders,
            upstreams,
            editingIndex,
          });

          return {
            ...prev,
            draft: {
              ...prev.draft,
              ...patch,
              providers: nextProviders,
              id,
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
    },
    [upstreams],
  );

  const openCreateDialog = () => {
    const draft = createEmptyUpstream();
    const nextProviders = normalizeProviders(draft.providers);
    const hasDuplicateId = upstreams.some(
      (upstream) => upstream.id.trim() === draft.id.trim(),
    );
    const nextId = hasDuplicateId
      ? createCopiedUpstreamId(draft.id, upstreams)
      : draft.id;
    setEditor({
      open: true,
      mode: "create",
      draft: { ...draft, id: nextId, providers: nextProviders },
    });
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
  };

  const saveDraft = () => {
    if (!editor.open) {
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
    <Card
      data-slot="upstreams-card"
      className="max-h-full min-h-0 gap-0 overflow-hidden rounded-none border-0 bg-transparent py-0 shadow-none"
    >
      <CardHeader className="shrink-0 gap-0 px-4 py-3 lg:px-6">
        <CardTitle className="text-[15px] font-semibold leading-5">
          {m.upstreams_title()}
        </CardTitle>
        <CardAction>
          <UpstreamsToolbar onAddClick={openCreateDialog} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-0 lg:px-6">
        {upstreams.length ? (
          <UpstreamsTable
            upstreams={upstreams}
            columns={columns}
            disableDelete={false}
            isCopyDisabled={isSpecialAccountBackedUpstream}
            isDeleteDisabled={isSpecialAccountBackedUpstream}
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
          <p className="text-sm text-muted-foreground">{m.upstreams_empty()}</p>
        )}
      </CardContent>

      <UpstreamEditorDialog
        editor={editor}
        providerOptions={mergedProviderOptions}
        showApiKeys={showApiKeys}
        onToggleApiKeys={onToggleApiKeys}
        onOpenChange={(open) => !open && setEditor({ open: false })}
        onChangeDraft={updateDraft}
        onSave={saveDraft}
      />
      <DeleteUpstreamDialog
        dialog={deleteDialog}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false })}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
