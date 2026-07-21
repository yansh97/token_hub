import { Switch } from "@/components/ui/switch";

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
  const errorText = `读取开机启动状态失败：${message || "未知错误"}`;

  return (
    <section
      data-slot="auto-start-card"
      className="mt-5 border-t border-border/70 pt-5"
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-5">开机启动</h2>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            登录系统后自动启动 Token Hub。
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onChange}
          disabled={isLoading || isError}
          aria-label="启用开机启动"
        />
      </div>
      {isLoading || isError ? (
        <div className="space-y-1 pt-2 text-[12px] leading-4 text-muted-foreground">
          {isLoading ? <p>正在读取开机启动状态...</p> : null}
          {isError ? <p className="text-destructive">{errorText}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
