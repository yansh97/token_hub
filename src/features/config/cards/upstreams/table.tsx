import type { ReactElement } from "react";

import { Copy, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getUpstreamLabel,
  getProviderLabel,
  toStatusLabel,
} from "@/features/config/cards/upstreams/constants";
import type {
  UpstreamColumnDefinition,
  UpstreamColumnId,
} from "@/features/config/cards/upstreams/types";
import type { UpstreamForm } from "@/features/config/types";

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
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className={TOOLTIP_CONTENT_CLASS}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export function UpstreamsToolbar({ onAddClick }: UpstreamsToolbarProps) {
  return (
    <Button type="button" size="sm" onClick={onAddClick}>
      <Plus className="size-4" aria-hidden="true" />
      添加提供商
    </Button>
  );
}

type UpstreamsTableHeaderProps = {
  columns: readonly UpstreamColumnDefinition[];
};

function UpstreamsTableHeader({ columns }: UpstreamsTableHeaderProps) {
  return (
    <thead className="sticky top-0 z-10">
      <tr>
        {columns.map((column) => (
          <th
            key={column.id}
            className={[
              "bg-background px-3 py-2 text-left text-[11px] font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]",
              column.headerClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {column.label()}
          </th>
        ))}
        <th className="w-[20%] bg-background px-3 py-2 text-left text-[11px] font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
          操作
        </th>
      </tr>
    </thead>
  );
}

function renderTextCell(value: string) {
  const trimmed = value.trim();
  return (
    <CellTooltip content={trimmed} disabled={!trimmed}>
      <span
        title={trimmed || undefined}
        className={
          trimmed
            ? "block w-full truncate text-foreground"
            : "block w-full truncate text-muted-foreground"
        }
      >
        {trimmed || CELL_PLACEHOLDER}
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
  const providers = upstream.providers
    .map((value) => value.trim())
    .filter(Boolean)
    .map(getProviderLabel);
  const label = providers.join(" · ") || CELL_PLACEHOLDER;

  return (
    <span
      className="block w-full truncate text-[12px] text-foreground/80"
      title={label}
    >
      {label}
    </span>
  );
}

function renderUpstreamCell(
  columnId: UpstreamColumnId,
  upstream: UpstreamForm,
) {
  switch (columnId) {
    case "id":
      return renderTextCell(upstream.id);
    case "provider":
      return renderProtocolCell(upstream);
    case "priority":
      return renderPriorityCell(upstream.priority);
    case "status":
      return (
        <span className="inline-flex items-center gap-1.5 text-[12px]">
          <span
            className={
              upstream.enabled
                ? "size-1.5 rounded-full bg-success"
                : "size-1.5 rounded-full bg-muted-foreground/45"
            }
            aria-hidden="true"
          />
          {toStatusLabel(upstream.enabled)}
        </span>
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
    <td className="w-[20%] px-3 py-2 align-middle">
      <div className="flex items-center justify-start gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label={`编辑${rowLabel}`}
          title="编辑"
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCopy}
          disabled={disableCopy}
          aria-label={`复制${rowLabel}`}
          title="复制"
        >
          <Copy className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onToggleEnabled}
          aria-label={`${enabled ? "停用" : "启用"}${rowLabel}`}
          title={enabled ? "停用" : "启用"}
        >
          {enabled ? (
            <PowerOff
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            <Power className="size-4 text-foreground" aria-hidden="true" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          disabled={disableDelete}
          aria-label={`删除${rowLabel}`}
          title="删除"
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
    <tr className="group h-10 border-b border-border/60 transition-colors hover:bg-muted/35 last:border-b-0">
      {columns.map((column) => (
        <td
          key={column.id}
          className={[
            "px-3 py-2 align-middle text-[13px]",
            column.cellClassName,
          ]
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
      <div className="min-h-0 max-h-full overflow-x-auto overflow-y-auto overscroll-none rounded-md border border-border/70">
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
