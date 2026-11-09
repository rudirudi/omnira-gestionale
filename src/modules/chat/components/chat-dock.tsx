"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, Hash, Maximize2, MessageSquarePlus, MessagesSquare, Minus, X } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/layout/user-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ChatOverviewRow } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { chatOpenDirectAction, chatTeamAction } from "../actions";
import { shortWhen } from "../format";
import { usePresence } from "../presence";
import { useChatData } from "../use-chat-data";
import { Avatar, convTitle, Thread } from "./thread";

type DockWindow = { id: string; min: boolean };
type DockState = { windows: DockWindow[]; listOpen: boolean };
const KEY = "omnira-chat-dock";

function readState(): DockState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as DockState | null;
    if (v && Array.isArray(v.windows)) return { windows: v.windows.filter((w) => typeof w?.id === "string"), listOpen: !!v.listOpen };
  } catch {}
  return { windows: [], listOpen: false };
}

/** Quante finestre stanno affiancate accanto all'elenco (menu laterale 240px, elenco 288px) */
function maxWindows() {
  return Math.max(1, Math.floor((window.innerWidth - 240 - 288 - 40) / 336));
}

const noop = () => () => {};

/**
 * Chat "agganciata" in basso a destra su tutte le pagine (stile Facebook):
 * barra con l'elenco conversazioni e finestre di chat affiancate. Su telefono: pulsante che apre /chat.
 */
export function ChatDock() {
  const pathname = usePathname();
  // Solo nel browser: lo stato delle finestre è salvato in questo dispositivo
  const mounted = React.useSyncExternalStore(noop, () => true, () => false);
  if (!mounted || pathname.startsWith("/chat")) return null;
  return <DockInner />;
}

function DockInner() {
  const { id: meId } = useCurrentUser();
  const presence = usePresence();
  const [state, setState] = React.useState<DockState>(readState);
  const [team, setTeam] = React.useState<{ id: string; full_name: string }[]>([]);
  const { windows, listOpen } = state;

  const openWindow = React.useCallback((id: string, min = false) => {
    setState((s) => {
      const rest = s.windows.filter((w) => w.id !== id);
      return { ...s, windows: [{ id, min }, ...rest].slice(0, maxWindows()) };
    });
  }, []);

  // Nuovo messaggio: la finestra si apre da sola (i canali restano ridotti, con il contatore)
  const onNewUnread = React.useCallback(
    (rows: ChatOverviewRow[]) => {
      setState((s) => {
        const add = rows.filter((c) => !s.windows.some((w) => w.id === c.id)).map((c) => ({ id: c.id, min: c.kind === "canale" }));
        return add.length ? { ...s, windows: [...add, ...s.windows].slice(0, maxWindows()) } : s;
      });
    },
    [],
  );

  const data = useChatData({ meId, onNewUnread });
  const { overview, threads, loadThread, markRead, watch, refreshOverview, setThread } = data;
  const byId = React.useMemo(() => new Map((overview ?? []).map((c) => [c.id, c])), [overview]);
  const names = React.useMemo(() => new Map(team.map((p) => [p.id, p.full_name])), [team]);
  const totalUnread = (overview ?? []).reduce((n, c) => n + c.unread, 0);

  React.useEffect(() => {
    chatTeamAction()
      .then(setTeam)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  // Finestre aperte: aggiornate in tempo reale, caricate se mancano, lette se visibili
  const visible = windows.filter((w) => !w.min && byId.has(w.id)).map((w) => w.id);
  const visibleKey = visible.join(",");
  React.useEffect(() => {
    const ids = visibleKey ? visibleKey.split(",") : [];
    watch(ids);
    for (const id of ids) if (!threads[id]) void loadThread(id);
  }, [visibleKey, threads, watch, loadThread]);
  const unreadVisible = visible.filter((id) => (byId.get(id)?.unread ?? 0) > 0).join(",");
  React.useEffect(() => {
    if (!unreadVisible || document.visibilityState !== "visible") return;
    for (const id of unreadVisible.split(",")) void markRead(id);
  }, [unreadVisible, markRead]);

  async function startDirect(personId: string) {
    const existing = overview?.find((c) => c.kind === "diretta" && c.other_id === personId);
    if (existing) return openWindow(existing.id);
    const res = await chatOpenDirectAction(personId);
    if (!res.ok || !res.data) return toast.error(res.ok ? "Non riesco ad aprire la chat." : res.error);
    const id = res.data;
    await refreshOverview();
    openWindow(id);
  }

  const setMin = (id: string, min: boolean) => setState((s) => ({ ...s, windows: s.windows.map((w) => (w.id === id ? { ...w, min } : w)) }));
  const close = (id: string) => setState((s) => ({ ...s, windows: s.windows.filter((w) => w.id !== id) }));
  const others = team.filter((p) => p.id !== meId);

  return (
    <>
      {/* Telefono: pulsante che apre la chat a tutta pagina */}
      <Link
        href="/chat"
        aria-label={totalUnread ? `Chat, ${totalUnread} messaggi non letti` : "Chat"}
        className="fixed right-4 bottom-4 z-40 flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background lg:hidden"
      >
        <MessagesSquare className="size-6" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-white tabular">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </Link>

      {/* Computer: elenco a destra, finestre affiancate verso sinistra */}
      <div className="pointer-events-none fixed right-4 bottom-0 z-40 hidden flex-row-reverse items-end gap-3 lg:flex" data-chat-dock>
        <section className={cn("pointer-events-auto flex w-72 flex-col overflow-hidden rounded-t-xl border border-b-0 bg-card shadow-2xl", listOpen && "h-[26rem]")}>
          <div className="flex h-11 shrink-0 items-center bg-sidebar text-sidebar-foreground">
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, listOpen: !s.listOpen }))}
              aria-expanded={listOpen}
              className="flex h-full min-w-0 flex-1 items-center gap-2 px-3 text-left text-[13.5px] font-semibold"
            >
              <MessagesSquare className="size-4.5" />
              Chat
              {totalUnread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white tabular">{totalUnread > 99 ? "99+" : totalUnread}</span>
              )}
              {listOpen ? <ChevronDown className="ml-auto size-4 opacity-80" /> : <ChevronUp className="ml-auto size-4 opacity-80" />}
            </button>
            {listOpen && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="flex size-8 items-center justify-center rounded-md hover:bg-white/15" aria-label="Nuova chat" title="Nuova chat">
                      <MessageSquarePlus className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="top" className="w-60">
                    <DropdownMenuLabel>Scrivi a…</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {others.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Nessun altro utente attivo</p>}
                    {others.map((p) => (
                      <DropdownMenuItem key={p.id} onSelect={() => void startDirect(p.id)}>
                        <Avatar id={p.id} name={p.full_name} size="sm" status />
                        {p.full_name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Link href="/chat" className="mr-1.5 flex size-8 items-center justify-center rounded-md hover:bg-white/15" aria-label="Apri la chat a tutta pagina" title="Apri a tutta pagina">
                  <Maximize2 className="size-4" />
                </Link>
              </>
            )}
          </div>
          {listOpen && (
            <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {overview === null && <li className="px-3 py-4 text-center text-xs text-muted-foreground">Carico…</li>}
              {overview?.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => openWindow(c.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted">
                    {c.kind === "canale" ? (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Hash className="size-4" />
                      </span>
                    ) : (
                      <Avatar id={c.other_id} name={c.other_name} status />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cn("truncate text-[13px]", c.unread ? "font-bold" : "font-semibold")}>{convTitle(c)}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{c.last_body || c.last_deleted ? shortWhen(c.last_at) : ""}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={cn("truncate text-[12px]", c.unread ? "font-medium text-foreground" : "text-muted-foreground")}>
                          {c.last_deleted ? "Messaggio eliminato" : c.last_body ? `${c.last_author === meId ? "Tu: " : ""}${c.last_body}` : c.kind === "canale" ? "Il canale di tutto il team" : "Nessun messaggio"}
                        </span>
                        {c.unread > 0 && <span className="ml-auto flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-destructive px-1 text-[10.5px] font-semibold text-white">{c.unread}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {windows.map((w) => {
          const c = byId.get(w.id);
          if (!c) return null;
          const title = c.kind === "canale" ? `#${convTitle(c)}` : convTitle(c);
          const alert = w.min && c.unread > 0;
          return (
            <section
              key={w.id}
              aria-label={`Chat con ${title}`}
              className={cn("pointer-events-auto flex w-80 flex-col overflow-hidden rounded-t-xl border border-b-0 bg-card shadow-2xl", !w.min && "h-[28rem]")}
            >
              <div className={cn("flex h-11 shrink-0 items-center gap-1 pr-1 text-white", alert ? "bg-destructive" : "bg-primary")}>
                <button type="button" onClick={() => setMin(w.id, !w.min)} className="flex h-full min-w-0 flex-1 items-center gap-2 pl-2.5 text-left" aria-expanded={!w.min}>
                  {c.kind === "canale" ? (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20">
                      <Hash className="size-3.5" />
                    </span>
                  ) : (
                    <Avatar id={c.other_id} name={c.other_name} size="sm" status />
                  )}
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-[13.5px] font-semibold">{title}</span>
                    <span className="truncate text-[10.5px] text-white/75">{c.kind === "canale" ? `${presence.onlineCount} online` : presence.status(c.other_id)}</span>
                  </span>
                  {alert && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-destructive">{c.unread}</span>}
                </button>
                <Link href={`/chat?c=${w.id}`} className="flex size-7 items-center justify-center rounded-md hover:bg-white/15" aria-label="Apri a tutta pagina" title="Apri a tutta pagina">
                  <Maximize2 className="size-3.5" />
                </Link>
                <button type="button" onClick={() => setMin(w.id, !w.min)} className="flex size-7 items-center justify-center rounded-md hover:bg-white/15" aria-label={w.min ? "Apri" : "Riduci"} title={w.min ? "Apri" : "Riduci"}>
                  {w.min ? <ChevronUp className="size-4" /> : <Minus className="size-4" />}
                </button>
                <button type="button" onClick={() => close(w.id)} className="flex size-7 items-center justify-center rounded-md hover:bg-white/15" aria-label="Chiudi" title="Chiudi">
                  <X className="size-4" />
                </button>
              </div>
              {!w.min && (
                <div className="flex min-h-0 flex-1 flex-col bg-muted/30">
                  <Thread
                    compact
                    conv={c}
                    meId={meId}
                    names={names}
                    thread={threads[w.id] ?? null}
                    highlight={null}
                    onBack={() => setMin(w.id, true)}
                    onLocalChange={(t) => setThread(w.id, t)}
                    onSent={() => void refreshOverview()}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
