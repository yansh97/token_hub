import { Fragment, type ComponentProps } from "react";
import { Link, useRouterState } from "@tanstack/react-router";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  CONFIG_SECTIONS,
  DEFAULT_CONFIG_SECTION,
  getSectionRoute,
} from "@/features/config/sections";

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const appTitle = "Token Hub";

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-sidebar-border/70"
      {...props}
    >
      <SidebarHeader className="border-b border-sidebar-border/70 px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-9 rounded-lg px-2.5 hover:bg-transparent"
            >
              <Link to={getSectionRoute(DEFAULT_CONFIG_SECTION)}>
                <span className="truncate text-base font-semibold tracking-[-0.01em]">
                  {appTitle}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="p-3 pt-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {CONFIG_SECTIONS.filter(
                (section) =>
                  section.id !== "providers" && section.id !== "agents",
              ).map((section) => {
                const isActive = pathname === section.route;
                const Icon = section.icon;
                return (
                  <Fragment key={section.id}>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={section.label()}
                        className="h-9 rounded-lg px-2.5 text-[13px] text-sidebar-foreground/75 data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-foreground [&>svg]:size-[17px]"
                      >
                        <Link to={section.route}>
                          <Icon />
                          <span>{section.label()}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </Fragment>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
