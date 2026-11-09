"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/components/layout/user-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { chatUnreadAction } from "../actions";

/** Numero di messaggi non letti accanto a "Chat" nel menu */
export function ChatUnreadBadge({ active }: { active: boolean }) {
  const { id } = useCurrentUser();
  const pathname = usePathname();
  const [count, setCount] = React.useState(0);

  const load = React.useCallback(() => {
    chatUnreadAction()
      .then(setCount)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    load();
  }, [load, pathname]);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-badge-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => load())
      .subscribe();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    window.addEventListener("chat:changed", load);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("chat:changed", load);
      window.removeEventListener("focus", load);
      void supabase.removeChannel(channel);
    };
  }, [id, load]);

  if (count === 0) return null;
  return (
    <span
      className={cn("ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular", active ? "bg-destructive text-white" : "bg-destructive text-white shadow-sm")}
      aria-label={`${count} messaggi non letti`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
