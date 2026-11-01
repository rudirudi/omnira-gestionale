"use client";

import { SearchButton } from "@/components/layout/command-palette";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/modules/notifiche/components/notification-bell";
import { useCurrentUser } from "./user-context";

/** Ricerca, notifiche e profilo: stanno nell'intestazione di ogni pagina (niente barra in alto) */
export function HeaderTools({ onDark = false }: { onDark?: boolean }) {
  const u = useCurrentUser();
  return (
    <div className="flex items-center gap-1.5">
      <SearchButton onDark={onDark} className="hidden w-56 md:flex" />
      <SearchButton onDark={onDark} className="w-9 justify-center px-0 md:hidden [&>span]:hidden" />
      <NotificationBell userId={u.id} onDark={onDark} />
      <UserMenu name={u.fullName} email={u.email} roleLabel={u.roleLabel} onDark={onDark} />
    </div>
  );
}

export function HeaderMenuButton({ onDark = false }: { onDark?: boolean }) {
  const u = useCurrentUser();
  return <MobileNav hidden={u.hiddenNav} onDark={onDark} />;
}
