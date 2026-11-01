import { Plus } from "lucide-react";
import Link from "next/link";
import { CommandPalette, SearchButton } from "@/components/layout/command-palette";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Brand, SidebarNav } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/modules/notifiche/components/notification-bell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCurrentUser } from "@/lib/auth";
import { can, ROLE_LABEL } from "@/lib/permissions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const hiddenNav = can.viewMoney(user.role) ? [] : ["/incassi"];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-svh">
        <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col bg-sidebar lg:flex">
          <Brand />
          <SidebarNav hidden={hiddenNav} />
          <div className="border-t border-sidebar-border px-5 py-3 text-[11px] text-sidebar-muted">Omnira Soft · uso interno</div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
            <MobileNav hidden={hiddenNav} />
            <SearchButton />
            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Plus /> <span className="hidden sm:inline">Nuovo</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/task?nuovo=1">Task</Link>
                  </DropdownMenuItem>
                  {can.manageProjects(user.role) && (
                    <DropdownMenuItem asChild>
                      <Link href="/progetti?nuovo=1">Progetto</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/clienti?nuovo=1">Cliente</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/lead?nuovo=1">Lead</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <NotificationBell userId={user.id} />
              <UserMenu name={user.full_name} email={user.email} roleLabel={ROLE_LABEL[user.role]} />
            </div>
          </header>
          </TopBar>
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
      </div>
      <CommandPalette />
    </TooltipProvider>
  );
}
