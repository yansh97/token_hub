import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RecentRequestsTable } from "@/features/dashboard/RecentRequestsTable";
import type { DashboardRequestItem } from "@/features/dashboard/types";
import { m } from "@/paraglide/messages.js";

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
    <div className="flex h-0 min-h-0 flex-1 flex-col px-4 lg:px-6">
      <Card
        data-slot="dashboard-recent"
        className="h-full min-h-0 flex-1 gap-0 rounded-none border-0 bg-transparent py-0 shadow-none"
      >
        <CardHeader className="shrink-0 gap-0 px-4 py-3">
          <CardTitle className="text-[15px] font-semibold leading-5">
            {m.dashboard_recent_title()}
          </CardTitle>
          <CardAction className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={onPrevPage}
            >
              {m.dashboard_prev_page()}
            </Button>
            <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-muted-foreground">
              {m.dashboard_page_indicator({
                page: String(page),
                totalPages: String(totalPages),
              })}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={onNextPage}
            >
              {m.dashboard_next_page()}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex h-full min-h-0 flex-1 flex-col px-4 pb-3 pt-0">
          {items.length ? (
            <RecentRequestsTable items={items} onSelectItem={onSelectItem} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {m.dashboard_no_data()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
