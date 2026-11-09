"use client";

import * as React from "react";
import { Hash, MessageSquarePlus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ChatOverviewRow } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { chatOpenDirectAction, chatSearchAction, type ChatSearchHit, type ChatThread } from "../actions";
import { shortWhen } from "../format";
import { useChatData } from "../use-chat-data";
import { Avatar, convTitle, Thread } from "./thread";

type Person = { id: string; full_name: string };

export function ChatView({
  meId,
  team,
  initialOverview,
  initialActive,
  initialThread,
}: {
  meId: string;
  team: Person[];
  initialOverview: ChatOverviewRow[];
  initialActive: string | null;
  initialThread: ChatThread | null;
}) {
  const [active, setActive] = React.useState(initialActive);
  const firstShown = initialActive ?? initialOverview[0]?.id;
  const data = useChatData({
    meId,
    initialOverview,
    initialThreads: firstShown && initialThread ? { [firstShown]: initialThread } : {},
  });
  const { threads, loadThread, refreshOverview, markRead, watch } = data;
  const overview = data.overview ?? initialOverview;
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<ChatSearchHit[] | null>(null);
  const [highlight, setHighlight] = React.useState<string | null>(null);

  // Arrivo da una notifica mentre la pagina è già aperta: segue il nuovo ?c=
  const [base, setBase] = React.useState(initialActive);
  if (base !== initialActive) {
    setBase(initialActive);
    setActive(initialActive);
  }

  const shown = active ?? overview[0]?.id ?? null;
  const shownConv = overview.find((c) => c.id === shown) ?? null;
  const names = React.useMemo(() => new Map(team.map((p) => [p.id, p.full_name])), [team]);

  // Conversazione mostrata: tenuta aggiornata, caricata se manca e segnata come letta
  const unreadShown = shownConv?.unread ?? 0;
  React.useEffect(() => {
    watch(shown ? [shown] : []);
  }, [shown, watch]);
  React.useEffect(() => {
    if (shown && !threads[shown]) void loadThread(shown);
  }, [shown, threads, loadThread]);
  React.useEffect(() => {
    if (shown && unreadShown > 0 && document.visibilityState === "visible") void markRead(shown);
  }, [shown, unreadShown, markRead]);

  function open(id: string) {
    setActive(id);
    setHighlight(null);
    window.history.pushState(null, "", `/chat?c=${id}`);
  }

  function back() {
    setActive(null);
    window.history.pushState(null, "", "/chat");
  }

  async function startDirect(personId: string) {
    const existing = overview.find((c) => c.kind === "diretta" && c.other_id === personId);
    if (existing) return open(existing.id);
    const res = await chatOpenDirectAction(personId);
    if (!res.ok || !res.data) return toast.error(res.ok ? "Non riesco ad aprire la chat." : res.error);
    const id = res.data;
    await refreshOverview();
    open(id);
  }

  // Ricerca nei messaggi (con un piccolo ritardo mentre si scrive)
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      chatSearchAction(q)
        .then(setHits)
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);
  const searching = query.trim().length >= 2;

  async function openHit(h: ChatSearchHit) {
    setQuery("");
    setHits(null);
    const loaded = threads[h.conversation_id]?.messages.some((m) => m.id === h.id);
    if (!loaded) await loadThread(h.conversation_id, { since: h.created_at });
    open(h.conversation_id);
    setHighlight(h.id);
  }

  const convLabel = (id: string) => {
    const c = overview.find((x) => x.id === id);
    return c ? (c.kind === "canale" ? `#${convTitle(c)}` : convTitle(c)) : "Conversazione";
  };
  const others = team.filter((p) => p.id !== meId);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden border-t">
      {/* Elenco conversazioni */}
      <aside className={cn("w-full min-w-0 flex-col border-r bg-card lg:flex lg:w-80 lg:shrink-0", active ? "hidden" : "flex")}>
        <div className="flex items-center gap-2 border-b p-3">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim().length < 2) setHits(null);
              }}
              placeholder="Cerca nei messaggi"
              aria-label="Cerca nei messaggi"
              className="h-9 w-full rounded-lg border bg-background pr-8 pl-8 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {query && (
              <button type="button" aria-label="Svuota ricerca" onClick={() => (setQuery(""), setHits(null))} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" className="size-9 shrink-0" aria-label="Nuova chat" title="Nuova chat">
                <MessageSquarePlus />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Scrivi a…</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {others.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Nessun altro utente attivo</p>}
              {others.map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => void startDirect(p.id)}>
                  <Avatar id={p.id} name={p.full_name} size="sm" />
                  {p.full_name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {searching ? (
            <div className="p-2">
              <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {hits === null ? "Cerco…" : hits.length ? `${hits.length} risultati` : "Nessun risultato"}
              </p>
              {hits?.map((h) => (
                <button key={h.id} type="button" onClick={() => void openHit(h)} className="flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted">
                  <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <span className="truncate font-semibold text-foreground">{convLabel(h.conversation_id)}</span>
                    <span className="ml-auto shrink-0">{shortWhen(h.created_at)}</span>
                  </span>
                  <span className="line-clamp-2 text-[13px]">
                    <span className="text-muted-foreground">{h.author_id === meId ? "Tu" : (names.get(h.author_id ?? "")?.split(" ")[0] ?? "Ex collega")}: </span>
                    {h.body}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <ul className="flex flex-col p-2">
              {overview.map((c) => {
                // Su mobile senza conversazione aperta nessuna riga è "selezionata"
                const sel = c.id === shown;
                const selCls = active ? "bg-primary/10" : "hover:bg-muted lg:bg-primary/10";
                const preview = c.last_deleted
                  ? "Messaggio eliminato"
                  : c.last_body
                    ? `${c.last_author === meId ? "Tu: " : c.kind === "canale" ? `${names.get(c.last_author ?? "")?.split(" ")[0] ?? "Ex collega"}: ` : ""}${c.last_body}`
                    : c.kind === "canale"
                      ? "Il canale di tutto il team"
                      : "Nessun messaggio";
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => open(c.id)}
                      aria-current={sel ? "true" : undefined}
                      className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors", sel ? selCls : "hover:bg-muted")}
                    >
                      {c.kind === "canale" ? (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Hash className="size-4" />
                        </span>
                      ) : (
                        <Avatar id={c.other_id} name={c.other_name} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={cn("truncate text-[13.5px]", c.unread ? "font-bold" : "font-semibold")}>{convTitle(c)}</span>
                          <span className={cn("ml-auto shrink-0 text-[11px]", c.unread ? "font-semibold text-primary" : "text-muted-foreground")}>
                            {c.last_body || c.last_deleted ? shortWhen(c.last_at) : ""}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className={cn("truncate text-[12.5px]", c.unread ? "font-medium text-foreground" : "text-muted-foreground", c.last_deleted && "italic")}>{preview}</span>
                          {c.unread > 0 && (
                            <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white tabular">
                              {c.unread > 99 ? "99+" : c.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Conversazione */}
      <section className={cn("min-w-0 flex-1 flex-col bg-muted/30 lg:flex", active ? "flex" : "hidden")}>
        {shownConv ? (
          <Thread
            key={shownConv.id}
            conv={shownConv}
            meId={meId}
            names={names}
            thread={threads[shownConv.id] ?? null}
            highlight={highlight}
            onBack={back}
            onLocalChange={(t) => data.setThread(shownConv.id, t)}
            onSent={() => void refreshOverview()}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">Scegli una conversazione</div>
        )}
      </section>
    </div>
  );
}
