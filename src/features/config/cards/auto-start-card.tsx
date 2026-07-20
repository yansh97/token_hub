import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { m } from "@/paraglide/messages.js";

type AutoStartStatus = "idle" | "loading" | "error";

type AutoStartCardProps = {
  enabled: boolean;
  status: AutoStartStatus;
  message: string;
  onChange: (value: boolean) => void;
};

export function AutoStartCard({
  enabled,
  status,
  message,
  onChange,
}: AutoStartCardProps) {
  const isLoading = status === "loading";
  const isError = status === "error";
  const errorText = m.auto_start_status_error({
    message: message || m.common_unknown(),
  });

  return (
    <Card
      data-slot="auto-start-card"
      className="gap-0 rounded-none border-0 bg-transparent py-4 shadow-none"
    >
      <CardHeader className="gap-1 px-0 py-0">
        <CardTitle className="text-[15px] leading-5">
          {m.auto_start_title()}
        </CardTitle>
        <CardDescription className="text-[12px] leading-4">
          {m.auto_start_desc()}
        </CardDescription>
        <CardAction>
          <Switch
            checked={enabled}
            onCheckedChange={onChange}
            disabled={isLoading || isError}
            aria-label={m.auto_start_aria()}
          />
        </CardAction>
      </CardHeader>
      {isLoading || isError ? (
        <CardContent className="space-y-1 px-0 pt-2 text-[12px] leading-4 text-muted-foreground">
          {isLoading ? <p>{m.auto_start_status_loading()}</p> : null}
          {isError ? <p className="text-destructive">{errorText}</p> : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
