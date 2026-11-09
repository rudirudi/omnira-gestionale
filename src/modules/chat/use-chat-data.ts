"use client";

import * as React from "react";
import type { ChatOverviewRow } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { chatMarkReadAction, chatMessagesAction, chatOverviewAction, type ChatThread } from "./actions";

/** Avvisa il badge del menu che i non letti sono cambiati */
export const notifyChatBadge = () => window.dispatchEvent(new Event("chat:changed"));

/**
 * Stato condiviso della chat (pagina e riquadro in basso): elenco conversazioni, messaggi
 * delle conversazioni guardate, tempo reale con controllo periodico di riserva.
 */
export function useChatData({
  meId,
  initialOverview = null,
  initialThreads = {},
  onNewUnread,
}: {
  meId: string;
  initialOverview?: ChatOverviewRow[] | null;
  initialThreads?: Record<string, ChatThread>;
  /** Conversazioni con nuovi messaggi non letti rispetto al giro precedente */
  onNewUnread?: (rows: ChatOverviewRow[]) => void;
}) {
  const [overview, setOverview] = React.useState<ChatOverviewRow[] | null>(initialOverview);
  const [threads, setThreads] = React.useState<Record<string, ChatThread>>(initialThreads);
  const watched = React.useRef<string[]>([]);
  const prevUnread = React.useRef<Map<string, number> | null>(initialOverview ? new Map(initialOverview.map((c) => [c.id, c.unread])) : null);
  const onNewRef = React.useRef(onNewUnread);
  React.useEffect(() => {
    onNewRef.current = onNewUnread;
  }, [onNewUnread]);

  const refreshOverview = React.useCallback(() => {
    return chatOverviewAction()
      .then((rows) => {
        const prev = prevUnread.current;
        prevUnread.current = new Map(rows.map((c) => [c.id, c.unread]));
        setOverview(rows);
        if (prev) {
          const fresh = rows.filter((c) => c.unread > (prev.get(c.id) ?? 0));
          if (fresh.length) onNewRef.current?.(fresh);
        }
        return rows;
      })
      .catch(() => null);
  }, []);

  const loadThread = React.useCallback((id: string, opts?: { since?: string }) => {
    return chatMessagesAction(id, opts)
      .then((t) => {
        setThreads((all) => ({ ...all, [id]: t }));
        return t;
      })
      .catch(() => null);
  }, []);

  const setThread = React.useCallback((id: string, t: ChatThread) => setThreads((all) => ({ ...all, [id]: t })), []);

  /** Conversazioni da tenere aggiornate (quelle visibili) */
  const watch = React.useCallback((ids: string[]) => {
    watched.current = ids;
  }, []);

  const markRead = React.useCallback((id: string) => {
    prevUnread.current?.set(id, 0);
    setOverview((list) => list?.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) ?? list);
    return chatMarkReadAction(id)
      .then(notifyChatBadge)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!prevUnread.current) void refreshOverview();
    const supabase = createClient();
    let live = false;
    const sync = () => {
      void refreshOverview();
      for (const id of watched.current) void loadThread(id);
    };
    const channel = supabase
      .channel(`chat-${meId}-${Math.random().toString(36).slice(2)}`)
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
    window.addEventListener("focus", sync);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", sync);
      void supabase.removeChannel(channel);
    };
  }, [meId, refreshOverview, loadThread]);

  return { overview, setOverview, threads, setThread, refreshOverview, loadThread, watch, markRead };
}
