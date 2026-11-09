"use client";

import * as React from "react";
import { ArrowLeft, Check, CheckCheck, Hash, Loader2, MessageSquarePlus, MoreHorizontal, Pencil, Search, SendHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ChatOverviewRow } from "@/lib/database.types";
import { projectColor } from "@/lib/project-color";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  chatDeleteAction,
  chatEditAction,
  chatMarkReadAction,
  chatMessagesAction,
  chatOpenDirectAction,
  chatOverviewAction,
  chatSearchAction,
  chatSendAction,
  type ChatMessage,
  type ChatSearchHit,
  type ChatThread,
} from "../actions";
import { dayLabel, initials, renderBody, sameDay, shortWhen, timeLabel } from "../format";

type Person = { id: string; full_name: string };

/** Avvisa il badge del menu che i non letti sono cambiati */
const notifyBadge = () => window.dispatchEvent(new Event("chat:changed"));

function Avatar({ id, name, size = "md" }: { id: string | null; name: string | null | undefined; size?: "sm" | "md" }) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold text-white", size === "sm" ? "size-7 text-[11px]" : "size-9 text-[12px]")}
      style={{ background: projectColor(id) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function convTitle(c: ChatOverviewRow) {
  return c.kind === "canale" ? (c.name ?? "Canale") : (c.other_name ?? "Ex collega");
}

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
  const [overview, setOverview] = React.useState(initialOverview);
  const [active, setActive] = React.useState(initialActive);
  const [threads, setThreads] = React.useState<Record<string, ChatThread>>(() => {
    const shown = initialActive ?? initialOverview[0]?.id;
    return shown && initialThread ? { [shown]: initialThread } : {};
  });
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

  const refreshOverview = React.useCallback(() => {
    chatOverviewAction()
      .then(setOverview)
      .catch(() => {});
  }, []);

  const loadThread = React.useCallback((id: string, opts?: { since?: string }) => {
    return chatMessagesAction(id, opts)
      .then((t) => {
        setThreads((all) => ({ ...all, [id]: t }));
        return t;
      })
      .catch(() => null);
  }, []);

  // Conversazione mostrata: carica se manca e segna come letta
  const unreadShown = shownConv?.unread ?? 0;
  React.useEffect(() => {
    if (!shown) return;
    if (!threads[shown]) void loadThread(shown);
  }, [shown, threads, loadThread]);
  React.useEffect(() => {
    if (!shown || unreadShown === 0 || document.visibilityState !== "visible") return;
    chatMarkReadAction(shown)
      .then(() => {
        setOverview((list) => list.map((c) => (c.id === shown ? { ...c, unread: 0 } : c)));
        notifyBadge();
      })
      .catch(() => {});
  }, [shown, unreadShown]);

  // Tempo reale + controllo periodico (più fitto se il tempo reale non è collegato)
  const shownRef = React.useRef(shown);
  React.useEffect(() => {
    shownRef.current = shown;
  }, [shown]);
  React.useEffect(() => {
    const supabase = createClient();
    let live = false;
    const sync = () => {
      refreshOverview();
      if (shownRef.current) void loadThread(shownRef.current);
    };
    const channel = supabase
      .channel(`chat-${meId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, sync)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_members" }, sync)
      .subscribe((status) => {
        live = status === "SUBSCRIBED";
      });
    let ticks = 0;
    const t = setInterval(() => {
      ticks += 1;
      if (document.visibilityState === "visible" && (!live || ticks % 6 === 0)) sync();
    }, 5_000);
    const onFocus = () => sync();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [meId, refreshOverview, loadThread]);

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
    await chatOverviewAction().then(setOverview);
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
            onLocalChange={(t) => setThreads((all) => ({ ...all, [shownConv.id]: t }))}
            onSent={refreshOverview}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">Scegli una conversazione</div>
        )}
      </section>
    </div>
  );
}

function Thread({
  conv,
  meId,
  names,
  thread,
  highlight,
  onBack,
  onLocalChange,
  onSent,
}: {
  conv: ChatOverviewRow;
  meId: string;
  names: Map<string, string>;
  thread: ChatThread | null;
  highlight: string | null;
  onBack: () => void;
  onLocalChange: (t: ChatThread) => void;
  onSent: () => void;
}) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const atBottom = React.useRef(true);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [typing, setTyping] = React.useState<{ name: string; at: number } | null>(null);
  const typingChannel = React.useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const lastTypingSent = React.useRef(0);
  const messages = React.useMemo(() => thread?.messages ?? [], [thread]);
  const lastId = messages[messages.length - 1]?.id;

  // Scorre in fondo ai nuovi messaggi se si era già in fondo
  React.useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || highlight) return;
    if (atBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastId, highlight]);
  React.useEffect(() => {
    if (!highlight) return;
    document.getElementById(`msg-${highlight}`)?.scrollIntoView({ block: "center" });
  }, [highlight, thread]);

  // "Sta scrivendo…" (solo tempo reale, nessun dato salvato)
  React.useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`chat-typing-${conv.id}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.userId && payload.userId !== meId) setTyping({ name: String(payload.name ?? ""), at: Date.now() });
      })
      .subscribe();
    typingChannel.current = ch;
    const t = setInterval(() => setTyping((v) => (v && Date.now() - v.at > 4000 ? null : v)), 1000);
    return () => {
      clearInterval(t);
      typingChannel.current = null;
      void supabase.removeChannel(ch);
    };
  }, [conv.id, meId]);
  // Un nuovo messaggio dell'altro chiude il "sta scrivendo"
  const lastAuthor = messages[messages.length - 1]?.author_id;
  const [seenLast, setSeenLast] = React.useState(lastId);
  if (seenLast !== lastId) {
    setSeenLast(lastId);
    if (lastAuthor !== meId) setTyping(null);
  }

  function sendTyping() {
    const now = Date.now();
    if (now - lastTypingSent.current < 2500) return;
    lastTypingSent.current = now;
    void typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { userId: meId, name: names.get(meId) ?? "" } });
  }

  async function loadOlder() {
    if (!thread || !messages[0]) return;
    setLoadingOlder(true);
    const el = scroller.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const older = await chatMessagesAction(conv.id, { before: messages[0].created_at }).catch(() => null);
    setLoadingOlder(false);
    if (!older) return;
    onLocalChange({ ...thread, messages: [...older.messages, ...messages], hasMore: older.hasMore });
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }

  async function send(text: string) {
    const tmp: ChatMessage = { id: `tmp-${Date.now()}`, conversation_id: conv.id, author_id: meId, body: text, edited_at: null, deleted_at: null, created_at: new Date().toISOString() };
    const cur = thread ?? { messages: [], reads: [], hasMore: false };
    atBottom.current = true;
    onLocalChange({ ...cur, messages: [...cur.messages, tmp] });
    const res = await chatSendAction(conv.id, text);
    if (!res.ok || !res.data) {
      onLocalChange({ ...cur, messages: cur.messages });
      toast.error(res.ok ? "Messaggio non inviato" : res.error);
      return false;
    }
    const sent = res.data;
    onLocalChange({ ...cur, messages: [...cur.messages.filter((m) => m.id !== sent.id), sent] });
    onSent();
    return true;
  }

  async function saveEdit(m: ChatMessage, text: string) {
    if (text.trim() === m.body) return setEditing(null);
    const res = await chatEditAction(m.id, text);
    if (!res.ok) return toast.error(res.error);
    setEditing(null);
    if (thread) onLocalChange({ ...thread, messages: messages.map((x) => (x.id === m.id ? { ...x, body: text.trim(), edited_at: new Date().toISOString() } : x)) });
  }

  async function remove(m: ChatMessage) {
    const res = await chatDeleteAction(m.id);
    if (!res.ok) return toast.error(res.error);
    if (thread) onLocalChange({ ...thread, messages: messages.map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString() } : x)) });
    onSent();
  }

  // Spunta di lettura sull'ultimo messaggio mio (conversazioni dirette)
  const otherRead = conv.kind === "diretta" ? thread?.reads.find((r) => r.user_id !== meId)?.last_read_at : undefined;
  const myLast = [...messages].reverse().find((m) => m.author_id === meId && !m.deleted_at && !m.id.startsWith("tmp-"));
  const title = conv.kind === "canale" ? (conv.name ?? "Canale") : (conv.other_name ?? "Ex collega");

  return (
    <>
      <header className="flex items-center gap-3 border-b bg-card px-3 py-2.5 sm:px-4">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onBack} aria-label="Torna alle conversazioni">
          <ArrowLeft />
        </Button>
        {conv.kind === "canale" ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Hash className="size-4" />
          </span>
        ) : (
          <Avatar id={conv.other_id} name={conv.other_name} />
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold">{conv.kind === "canale" ? `#${title}` : title}</h2>
          <p className="truncate text-[12px] text-muted-foreground">
            {typing ? <span className="text-primary">{typing.name.split(" ")[0] || "Qualcuno"} sta scrivendo…</span> : conv.kind === "canale" ? "Tutto il team" : "Messaggi diretti"}
          </p>
        </div>
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
      >
        {!thread ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <>
            {thread.hasMore && (
              <div className="mb-3 flex justify-center">
                <Button variant="outline" size="sm" onClick={() => void loadOlder()} disabled={loadingOlder}>
                  {loadingOlder && <Loader2 className="animate-spin" />} Carica messaggi precedenti
                </Button>
              </div>
            )}
            {messages.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {conv.kind === "canale" ? "Nessun messaggio nel canale. Scrivi il primo!" : `Inizia la conversazione con ${title.split(" ")[0]}.`}
              </p>
            )}
            <ol className="flex flex-col">
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const newDay = !prev || !sameDay(prev.created_at, m.created_at);
                const grouped = !newDay && prev.author_id === m.author_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
                const mine = m.author_id === meId;
                const author = mine ? "Tu" : (names.get(m.author_id ?? "") ?? "Ex collega");
                return (
                  <React.Fragment key={m.id}>
                    {newDay && (
                      <li className="my-3 flex items-center gap-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase" aria-hidden>
                        <span className="h-px flex-1 bg-border" />
                        {dayLabel(m.created_at)}
                        <span className="h-px flex-1 bg-border" />
                      </li>
                    )}
                    <li id={`msg-${m.id}`} className={cn("group flex items-end gap-2", mine ? "flex-row-reverse" : "flex-row", grouped ? "mt-0.5" : "mt-3")}>
                      {!mine && (grouped ? <span className="w-7 shrink-0" /> : <Avatar id={m.author_id} name={author} size="sm" />)}
                      <div className={cn("flex max-w-[85%] min-w-0 flex-col sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
                        {!grouped && (
                          <p className="mb-0.5 px-1 text-[11.5px] text-muted-foreground">
                            {!mine && conv.kind === "canale" && <span className="mr-1.5 font-semibold text-foreground">{author}</span>}
                            {timeLabel(m.created_at)}
                          </p>
                        )}
                        {editing === m.id ? (
                          <EditBox initial={m.body} onCancel={() => setEditing(null)} onSave={(t) => void saveEdit(m, t)} />
                        ) : (
                          <div className="flex items-center gap-1">
                            {mine && !m.deleted_at && !m.id.startsWith("tmp-") && (
                              <MessageMenu onEdit={() => setEditing(m.id)} onDelete={() => void remove(m)} />
                            )}
                            <div
                              title={grouped ? timeLabel(m.created_at) : undefined}
                              className={cn(
                                "rounded-2xl px-3 py-2 text-[13.5px] leading-snug break-words whitespace-pre-wrap shadow-xs",
                                m.deleted_at
                                  ? "border border-dashed bg-transparent text-muted-foreground italic shadow-none"
                                  : mine
                                    ? "rounded-br-md bg-primary text-primary-foreground"
                                    : "rounded-bl-md border bg-card",
                                m.id.startsWith("tmp-") && "opacity-60",
                                highlight === m.id && "ring-2 ring-warning ring-offset-2 ring-offset-background",
                              )}
                            >
                              {m.deleted_at ? "Messaggio eliminato" : renderBody(m.body, mine)}
                              {m.edited_at && !m.deleted_at && <span className={cn("ml-1.5 text-[10.5px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>(modificato)</span>}
                            </div>
                          </div>
                        )}
                        {myLast?.id === m.id && conv.kind === "diretta" && (
                          <p className="mt-0.5 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                            {otherRead && otherRead >= m.created_at ? (
                              <>
                                <CheckCheck className="size-3.5 text-primary" /> Letto
                              </>
                            ) : (
                              <>
                                <Check className="size-3.5" /> Inviato
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </li>
                  </React.Fragment>
                );
              })}
            </ol>
          </>
        )}
      </div>

      <Composer key={conv.id} placeholder={conv.kind === "canale" ? `Scrivi in #${title}` : `Scrivi a ${title.split(" ")[0]}`} onSend={send} onTyping={sendTyping} />
    </>
  );
}

function MessageMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = React.useState(false);
  return (
    <DropdownMenu onOpenChange={(o) => !o && setConfirm(false)}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="size-7 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-lg:opacity-60" aria-label="Azioni messaggio">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Modifica
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={(e) => {
            if (!confirm) {
              e.preventDefault();
              setConfirm(true);
            } else onDelete();
          }}
        >
          <Trash2 /> {confirm ? "Conferma eliminazione" : "Elimina"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (t: string) => void; onCancel: () => void }) {
  const [text, setText] = React.useState(initial);
  return (
    <div className="flex w-72 max-w-full flex-col gap-1.5 rounded-xl border bg-card p-2 shadow-sm">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (text.trim()) onSave(text);
          }
          if (e.key === "Escape") onCancel();
        }}
        rows={Math.min(6, text.split("\n").length + 1)}
        maxLength={4000}
        aria-label="Modifica messaggio"
        className="w-full resize-none rounded-md bg-transparent text-[13.5px] outline-none"
      />
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Annulla
        </Button>
        <Button size="sm" onClick={() => text.trim() && onSave(text)}>
          Salva
        </Button>
      </div>
    </div>
  );
}

function Composer({ placeholder, onSend, onTyping }: { placeholder: string; onSend: (text: string) => Promise<boolean>; onTyping: () => void }) {
  const [text, setText] = React.useState("");
  const ref = React.useRef<HTMLTextAreaElement>(null);

  // Altezza automatica fino a ~6 righe
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  function submit() {
    const t = text.trim();
    if (!t) return;
    setText("");
    void onSend(t).then((ok) => {
      if (!ok) setText(t);
    });
    ref.current?.focus();
  }

  return (
    <div className="border-t bg-card p-2.5 sm:p-3">
      <div className="flex items-end gap-2 rounded-xl border bg-background px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring/40">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder={placeholder}
          aria-label="Scrivi un messaggio"
          className="max-h-40 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-[14px] outline-none placeholder:text-muted-foreground"
        />
        <Button size="icon-sm" className="mb-0.5 shrink-0" onClick={submit} disabled={!text.trim()} aria-label="Invia">
          <SendHorizontal />
        </Button>
      </div>
      <p className="mt-1 hidden px-1 text-[11px] text-muted-foreground sm:block">Invio per mandare · Maiusc+Invio per andare a capo · scrivi un codice come P-2026-001 per collegare progetti e task</p>
    </div>
  );
}
