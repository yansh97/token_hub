import { CONFIG_SECTIONS, DEFAULT_CONFIG_SECTION } from "@/features/config/sections";
import { getRouteHash, useAppRoute } from "@/lib/router";

export function AppSidebar() {
  const activeRoute = useAppRoute();

  return (
    <aside className="flex w-44 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-12 shrink-0 items-center px-4">
        <a
          href={getRouteHash(DEFAULT_CONFIG_SECTION)}
          className="truncate text-[15px] font-semibold leading-5"
        >
          Token Hub
        </a>
      </div>
      <nav aria-label="主导航" className="flex flex-col gap-1 p-2.5">
        {CONFIG_SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeRoute === section.id;
          return (
            <a
              key={section.id}
              href={getRouteHash(section.id)}
              aria-current={active ? "page" : undefined}
              className={[
                "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/20",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/55 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
              ].join(" ")}
            >
              <Icon className="size-[17px] shrink-0" aria-hidden="true" />
              <span className="truncate">{section.label}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
