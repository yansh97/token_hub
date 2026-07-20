import type { ReactElement } from "react";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Ban, Check, Copy, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getUpstreamLabel,
  PROTOCOL_OPTIONS,
  toStatusLabel,
} from "@/features/config/cards/upstreams/constants";
import type {
  UpstreamColumnDefinition,
  UpstreamColumnId,
} from "@/features/config/cards/upstreams/types";
import type { UpstreamForm } from "@/features/config/types";
import { m } from "@/paraglide/messages.js";

type UpstreamsToolbarProps = {
  onAddClick: () => void;
};

const CELL_PLACEHOLDER = "—";
const TOOLTIP_CONTENT_CLASS = "max-w-[560px] whitespace-pre-wrap break-words";

type CellTooltipProps = {
  content: string;
  disabled?: boolean;
  children: ReactElement;
};

function shouldDisableTooltip(content: string) {
  const trimmed = content.trim();
  return trimmed.length === 0 || trimmed === CELL_PLACEHOLDER;
}

function CellTooltip({ content, disabled, children }: CellTooltipProps) {
  if (disabled || shouldDisableTooltip(content)) {
    return children;
  }
  return (
    <TooltipPrimitive.Root>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className={TOOLTIP_CONTENT_CLASS}>
        {content}
      </TooltipContent>
    </TooltipPrimitive.Root>
  );
}

export function UpstreamsToolbar({ onAddClick }: UpstreamsToolbarProps) {
  return (
    <div className="flex items-center">
      <Button type="button" variant="outline" size="sm" onClick={onAddClick}>
        {m.upstreams_add()}
      </Button>
    </div>
  );
}

type UpstreamsTableHeaderProps = {
  columns: readonly UpstreamColumnDefinition[];
};

function UpstreamsTableHeader({ columns }: UpstreamsTableHeaderProps) {
  return (
    <thead className="sticky top-0 z-10">
      <tr className="border-b border-border/60 bg-background/40">
        {columns.map((column) => (
          <th
            key={column.id}
            className={[
              "px-3 py-2 text-left text-[12px] font-medium text-muted-foreground",
              column.headerClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {column.label()}
          </th>
        ))}
        <th className="w-[20%] min-w-[10rem] px-3 py-2 text-left text-[12px] font-medium text-muted-foreground">
          {m.common_actions()}
        </th>
      </tr>
    </thead>
  );
}

function renderTextCell(value: string, placeholder: string) {
  const trimmed = value.trim();
  return (
    <CellTooltip content={trimmed} disabled={!trimmed}>
      <span
        className={
          trimmed
            ? "block w-full truncate text-foreground"
            : "block w-full truncate text-muted-foreground"
        }
      >
        {trimmed || placeholder}
      </span>
    </CellTooltip>
  );
}

function renderPriorityCell(value: string) {
  return value.trim() ? (
    <span className="text-foreground">{value}</span>
  ) : (
    <span className="text-muted-foreground">0</span>
  );
}

function renderProtocolCell(upstream: UpstreamForm) {
  const supportedProtocols = new Set(
    upstream.providers.map((value) => value.trim()).filter(Boolean),
  );

  return (
    <div className="flex flex-wrap gap-1">
      {PROTOCOL_OPTIONS.map((protocol) => (
        <Badge
          key={protocol}
          variant={supportedProtocols.has(protocol) ? "default" : "secondary"}
          className="h-6 rounded-full border-transparent px-2 text-xs font-medium"
        >
          {protocol}
        </Badge>
      ))}
    </div>
  );
}

function renderUpstreamCell(
  columnId: UpstreamColumnId,
  upstream: UpstreamForm,
) {
  switch (columnId) {
    case "id":
      return renderTextCell(upstream.id, "openai-default");
    case "provider":
      return renderProtocolCell(upstream);
    case "priority":
      return renderPriorityCell(upstream.priority);
    case "status":
      return (
        <Badge
          variant={upstream.enabled ? "default" : "secondary"}
          className="h-6 rounded-full px-2 text-xs font-medium"
        >
          {toStatusLabel(upstream.enabled)}
        </Badge>
      );
  }
}

type UpstreamRowActionsProps = {
  rowLabel: string;
  enabled: boolean;
  disableCopy: boolean;
  disableDelete: boolean;
  onEdit: () => void;
  onCopy: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
};

function UpstreamRowActions({
  rowLabel,
  enabled,
  disableCopy,
  disableDelete,
  onEdit,
  onCopy,
  onToggleEnabled,
  onDelete,
}: UpstreamRowActionsProps) {
  return (
    <td className="w-[20%] min-w-[10rem] px-3 py-2 align-top">
      <div className="flex justify-start gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label={m.upstreams_row_edit({ rowLabel })}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCopy}
          disabled={disableCopy}
          aria-label={m.upstreams_row_copy({ rowLabel })}
        >
          <Copy className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onToggleEnabled}
          aria-label={
            enabled
              ? m.upstreams_row_disable({ rowLabel })
              : m.upstreams_row_enable({ rowLabel })
          }
        >
          {enabled ? (
            <Ban className="size-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Check
              className="size-4 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          disabled={disableDelete}
          aria-label={m.upstreams_row_delete({ rowLabel })}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </td>
  );
}

type UpstreamsTableRowProps = {
  upstream: UpstreamForm;
  upstreamIndex: number;
  displayIndex: number;
  columns: readonly UpstreamColumnDefinition[];
  disableDelete: boolean;
  isCopyDisabled?: (upstream: UpstreamForm) => boolean;
  isDeleteDisabled?: (upstream: UpstreamForm) => boolean;
  onEdit: (index: number) => void;
  onCopy: (index: number) => void;
  onToggleEnabled: (index: number) => void;
  onDelete: (index: number) => void;
};

function UpstreamsTableRow({
  upstream,
  upstreamIndex,
  displayIndex,
  columns,
  disableDelete,
  isCopyDisabled,
  isDeleteDisabled,
  onEdit,
  onCopy,
  onToggleEnabled,
  onDelete,
}: UpstreamsTableRowProps) {
  const rowLabel = getUpstreamLabel(displayIndex);
  const copyDisabled = isCopyDisabled?.(upstream) === true;
  const deleteDisabled = disableDelete || isDeleteDisabled?.(upstream) === true;
  return (
    <tr className="group border-b border-border/60 last:border-b-0">
      {columns.map((column) => (
        <td
          key={column.id}
          className={["px-3 py-2 align-top text-[13px]", column.cellClassName]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="flex h-7 min-w-0 items-center">
            {renderUpstreamCell(column.id, upstream)}
          </div>
        </td>
      ))}
      <UpstreamRowActions
        rowLabel={rowLabel}
        enabled={upstream.enabled}
        disableCopy={copyDisabled}
        disableDelete={deleteDisabled}
        onEdit={() => onEdit(upstreamIndex)}
        onCopy={() => onCopy(upstreamIndex)}
        onToggleEnabled={() => onToggleEnabled(upstreamIndex)}
        onDelete={() => onDelete(upstreamIndex)}
      />
    </tr>
  );
}

export type UpstreamsTableProps = {
  upstreams: UpstreamForm[];
  columns: readonly UpstreamColumnDefinition[];
  disableDelete: boolean;
  isCopyDisabled?: (upstream: UpstreamForm) => boolean;
  isDeleteDisabled?: (upstream: UpstreamForm) => boolean;
  onEdit: (index: number) => void;
  onCopy: (index: number) => void;
  onToggleEnabled: (index: number) => void;
  onDelete: (index: number) => void;
};

type SortedUpstreamEntry = {
  upstream: UpstreamForm;
  upstreamIndex: number;
  priority: number;
};

function parsePriorityValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  const number = Number.parseInt(trimmed, 10);
  return Number.isFinite(number) ? number : 0;
}

function sortUpstreamsByPriority(upstreams: UpstreamForm[]) {
  // Display order follows priority descending; ties keep original list order.
  const entries = upstreams.map(
    (upstream, upstreamIndex): SortedUpstreamEntry => ({
      upstream,
      upstreamIndex,
      priority: parsePriorityValue(upstream.priority),
    }),
  );
  entries.sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }
    return left.upstreamIndex - right.upstreamIndex;
  });
  return entries;
}

export function UpstreamsTable({
  upstreams,
  columns,
  disableDelete,
  isCopyDisabled,
  isDeleteDisabled,
  onEdit,
  onCopy,
  onToggleEnabled,
  onDelete,
}: UpstreamsTableProps) {
  const sortedUpstreams = sortUpstreamsByPriority(upstreams);
  return (
    <TooltipProvider>
      <div className="min-h-0 max-h-full overflow-x-hidden overflow-y-auto overscroll-none rounded-md border border-border/60">
        <table className="w-full table-fixed border-collapse text-[13px]">
          <UpstreamsTableHeader columns={columns} />
          <tbody>
            {sortedUpstreams.map((entry, displayIndex) => (
              <UpstreamsTableRow
                key={entry.upstreamIndex}
                upstream={entry.upstream}
                upstreamIndex={entry.upstreamIndex}
                displayIndex={displayIndex}
                columns={columns}
                disableDelete={disableDelete}
                isCopyDisabled={isCopyDisabled}
                isDeleteDisabled={isDeleteDisabled}
                onEdit={onEdit}
                onCopy={onCopy}
                onToggleEnabled={onToggleEnabled}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
