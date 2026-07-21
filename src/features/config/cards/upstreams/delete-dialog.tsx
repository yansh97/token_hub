import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getUpstreamLabel } from "@/features/config/cards/upstreams/constants";
import type { DeleteDialogState } from "@/features/config/cards/upstreams/types";

type DeleteUpstreamDialogProps = {
  dialog: DeleteDialogState;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DeleteUpstreamDialog({
  dialog,
  onOpenChange,
  onConfirm,
}: DeleteUpstreamDialogProps) {
  const description = dialog.open
    ? `将删除${getUpstreamLabel(dialog.index)}。`
    : "";
  return (
    <AlertDialog open={dialog.open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{"删除提供商？"}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{"取消"}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60"
          >
            {"删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
