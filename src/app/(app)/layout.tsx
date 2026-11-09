import { CommandPalette } from "@/components/layout/command-palette";
import { Brand, SidebarNav } from "@/components/layout/sidebar";
import { CurrentUserProvider } from "@/components/layout/user-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCurrentUser } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { Assistant } from "@/modules/assistente/components/assistant";
import { ChatDock } from "@/modules/chat/components/chat-dock";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const hiddenNav = can.viewMoney(user.role) ? [] : ["/incassi", "/preventivi", "/listino"];

  return (
    <CurrentUserProvider value={{ id: user.id, fullName: user.full_name, email: user.email, roleLabel: ROLE_LABEL[user.role], hiddenNav }}>
      <TooltipProvider delayDuration={300}>
        <div className="flex min-h-svh">
          <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col bg-sidebar lg:flex">
            <Brand />
            <SidebarNav hidden={hiddenNav} />
            <div className="border-t border-sidebar-border px-5 py-3 text-[11px] text-sidebar-muted">Omnira Soft · uso interno</div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="flex flex-1 flex-col pb-20 has-[[data-chat-page]]:pb-0 lg:pb-12 lg:has-[[data-chat-page]]:pb-0">{children}</main>
          </div>
        </div>
        <CommandPalette />
        <ChatDock />
        {FEATURES.assistant && <Assistant />}
      </TooltipProvider>
    </CurrentUserProvider>
  );
}
