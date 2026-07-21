import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { LayoutGroup } from "motion/react";

import { AppSidebar } from "@/layouts/app-sidebar";
import { SiteHeader } from "@/layouts/site-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

type AppShellProps = {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
};

type PageChromeContextValue = {
  title: string;
  actions: ReactNode;
  setTitle: (title: string) => void;
  setActions: (actions: ReactNode) => void;
};

const PageChromeContext = createContext<PageChromeContextValue | null>(null);

/**
 * 真正的壳子 DOM：侧边栏 + 顶栏 + 内容区。
 * 由 AppShellProvider 只挂一次；测试/无 Provider 时 AppShell 退回整壳渲染。
 */
function AppShellFrame({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SidebarProvider
      className="h-full"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 37.7143)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      {/* LayoutGroup 包住侧边栏，layoutId 激活条在同一实例内滑动 */}
      <LayoutGroup id="app-sidebar-nav">
        <AppSidebar />
      </LayoutGroup>
      <SidebarInset className="min-h-0 md:m-0 md:ml-0 md:rounded-none md:shadow-none">
        <div className="flex flex-1 min-h-0 flex-col">
          <ScrollArea
            className="flex-1 min-h-0"
            viewportClassName="[&>div]:!block [&>div]:!h-full"
          >
            <div className="@container/main flex h-full min-h-0 flex-col gap-1">
              <SiteHeader title={title} actions={actions} />
              <div
                data-slot="app-shell-content"
                className="flex min-h-0 flex-1 flex-col gap-2.5 py-2.5 md:gap-3.5 md:py-3.5"
              >
                {children}
              </div>
            </div>
          </ScrollArea>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * 应用级持久壳：侧边栏不随路由卸载。
 * 必须包在路由 Outlet 外，页面里的 <AppShell> 只同步 title/actions。
 */
export function AppShellProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  const [actions, setActions] = useState<ReactNode>(null);

  const value = useMemo(
    () => ({
      title,
      actions,
      setTitle,
      setActions,
    }),
    [title, actions]
  );

  return (
    <PageChromeContext.Provider value={value}>
      <AppShellFrame title={title} actions={actions}>
        {children}
      </AppShellFrame>
    </PageChromeContext.Provider>
  );
}

/**
 * 页面入口：有 Provider 时只同步顶栏并渲染 children（侧边栏不重挂）；
 * 无 Provider 时退回完整壳（兼容单测直接 render）。
 */
export function AppShell({ title, children, actions }: AppShellProps) {
  const chrome = useContext(PageChromeContext);

  useLayoutEffect(() => {
    if (!chrome) {
      return;
    }
    chrome.setTitle(title);
    chrome.setActions(actions ?? null);
    console.debug("[app-shell] sync page chrome", {
      title,
      hasActions: Boolean(actions),
    });
  }, [actions, chrome, title]);

  if (!chrome) {
    return (
      <AppShellFrame title={title} actions={actions}>
        {children}
      </AppShellFrame>
    );
  }

  return children;
}
