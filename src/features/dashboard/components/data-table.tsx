import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RecentRequestsTable } from "@/features/dashboard/RecentRequestsTable";
import type { DashboardRequestItem } from "@/features/dashboard/types";

type DataTableProps = {
  items: DashboardRequestItem[];
  page: number;
  totalPages: number;
  loading: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSelectItem?: (item: DashboardRequestItem) => void;
};

export function DataTable({
  items,
  page,
  totalPages,
  loading,
  onPrevPage,
  onNextPage,
  onSelectItem,
}: DataTableProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h2 className="text-[15px] font-semibold leading-5">请求记录</h2>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 min-w-16 text-center text-[11px] tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={onPrevPage}
            aria-label="上一页"
            title="上一页"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={page >= totalPages || loading}
            onClick={onNextPage}
            aria-label="下一页"
            title="下一页"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      {items.length ? (
        <RecentRequestsTable items={items} onSelectItem={onSelectItem} />
      ) : (
        <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-border text-[13px] text-muted-foreground">
          暂无请求记录
        </div>
      )}
    </section>
  );
}
