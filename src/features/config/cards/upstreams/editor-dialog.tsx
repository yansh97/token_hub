import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UpstreamEditorFields } from "@/features/config/cards/upstreams/editor-dialog-form";
import type { UpstreamEditorState } from "@/features/config/cards/upstreams/types";
import type { UpstreamForm } from "@/features/config/types";

type UpstreamEditorDialogProps = {
  editor: UpstreamEditorState;
  errors: Readonly<Record<string, string>>;
  providerOptions: readonly string[];
  showApiKeys: boolean;
  onToggleApiKeys: () => void;
  onOpenChange: (open: boolean) => void;
  onChangeDraft: (patch: Partial<UpstreamForm>) => void;
  onFieldBlur: (field: string) => void;
  onSave: () => void;
};

export function UpstreamEditorDialog({
  editor,
  errors,
  providerOptions,
  showApiKeys,
  onToggleApiKeys,
  onOpenChange,
  onChangeDraft,
  onFieldBlur,
  onSave,
}: UpstreamEditorDialogProps) {
  const title = editor.open
    ? editor.mode === "create"
      ? "添加提供商"
      : "编辑提供商"
    : "提供商";
  return (
    <AlertDialog open={editor.open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[calc(100vh-2rem)] w-[min(40rem,calc(100vw-2rem))] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 text-[13px]">
        <AlertDialogHeader className="flex-row items-center justify-between gap-6 border-b px-4 py-3 text-left">
          <div className="space-y-2">
            <AlertDialogTitle className="text-[14px]">{title}</AlertDialogTitle>
          </div>
          {editor.open ? (
            <Label className="flex shrink-0 items-center gap-2 text-[13px] font-normal">
              <span>
                {editor.draft.enabled
                  ? "启用"
                  : "禁用"}
              </span>
              <Switch
                checked={editor.draft.enabled}
                onCheckedChange={(enabled) => onChangeDraft({ enabled })}
                aria-label={"状态"}
              />
            </Label>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogBody className="max-h-none min-h-0 overflow-y-auto px-4 py-3">
          {editor.open ? (
            <UpstreamEditorFields
              draft={editor.draft}
              errors={errors}
              providerOptions={providerOptions}
              showApiKeys={showApiKeys}
              onToggleApiKeys={onToggleApiKeys}
              onChangeDraft={onChangeDraft}
              onFieldBlur={onFieldBlur}
            />
          ) : null}
        </AlertDialogBody>
        <AlertDialogFooter className="border-t px-4 py-2.5">
          <AlertDialogCancel>
            {"取消"}
          </AlertDialogCancel>
          <Button type="button" onClick={onSave}>
            {"保存"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
