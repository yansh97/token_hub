import { Fragment, type ComponentProps } from "react"
import { Link, useRouterState } from "@tanstack/react-router"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { CONFIG_SECTIONS, DEFAULT_CONFIG_SECTION, getSectionRoute } from "@/features/config/sections"

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const appTitle = import.meta.env.DEV ? "Token Hub (dev)" : "Token Hub"

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to={getSectionRoute(DEFAULT_CONFIG_SECTION)}>
                <span className="text-base font-semibold">{appTitle}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {CONFIG_SECTIONS
                .filter((section) => section.id !== "providers" && section.id !== "agents")
                .map((section) => {
                  const isActive = pathname === section.route
                  const Icon = section.icon
                  return (
                    <Fragment key={section.id}>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={section.label()}>
                          <Link to={section.route}>
                            <Icon />
                            <span>{section.label()}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </Fragment>
                  )
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
