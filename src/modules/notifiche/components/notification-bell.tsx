"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AtSign, Bell, CheckCheck, MessageSquare, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { listNotificationsAction, markNotificationsReadAction, type NotificationItem } from "../actions";

const ICON: Record<string, typeof Bell> = { menzione: AtSign, commento: MessageSquare, task_assegnato: UserPlus };

function when(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "ora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const unread = items.filter((n) => !n.read_at).length;

  const load = React.useCallback(() => {
    listNotificationsAction().then(setItems).catch(() => {});
  }, []);

  React.useEffect(() => {
    load();
    // Realtime: nuove notifiche appena arrivano; in più un controllo ogni 2 minuti
    const supabase = createClient();
    const channel = supabase
      .channel(`notifiche-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    const t = setInterval(load, 120_000);
    return () => {
      clearInterval(t);
      void supabase.removeChannel(channel);
    };
  }, [load, userId]);

  async function open(n: NotificationItem) {
    if (!n.read_at) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      void markNotificationsReadAction([n.id]);
    }
    if (n.link) router.push(n.link);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={unread ? `Notifiche, ${unread} non lette` : "Notifiche"}>
          <Bell />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white tabular">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-[13px] font-semibold">Notifiche</p>
          {unread > 0 && (
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={async () => {
                setItems((l) => l.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
                await markNotificationsReadAction();
              }}
            >
              <CheckCheck className="size-3.5" /> Segna tutte come lette
            </button>
          )}
        </div>
        <ul className="max-h-[420px] overflow-y-auto">
          {items.length === 0 && <li className="px-3 py-10 text-center text-[13px] text-muted-foreground">Nessuna notifica</li>}
          {items.map((n) => {
            const Icon = ICON[n.type] ?? Bell;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn("flex w-full gap-3 px-3 py-2.5 text-left hover:bg-muted", !n.read_at && "bg-primary/5")}
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-3.5 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-[13px] font-medium">{n.title}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{when(n.created_at)}</span>
                    </span>
                    {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                  </span>
                  {!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Non letta" />}
                </button>
              </li>
            );
          })}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
