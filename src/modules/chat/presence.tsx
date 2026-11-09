"use client";

import * as React from "react";
import { chatPresenceAction } from "./actions";

const ONLINE_MS = 150_000;
type Presence = { seen: Record<string, string>; now: number };
const Ctx = React.createContext<Presence>({ seen: {}, now: 0 });

/** Tiene aggiornata la presenza: segnale ogni minuto e lista di chi è online */
export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = React.useState<Presence>({ seen: {}, now: 0 });

  React.useEffect(() => {
    const beat = () =>
      chatPresenceAction()
        .then((seen) => setValue({ seen, now: Date.now() }))
        .catch(() => {});
    void beat();
    const t = setInterval(beat, 60_000);
    const onVisible = () => document.visibilityState === "visible" && void beat();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePresence() {
  const { seen, now } = React.useContext(Ctx);
  return React.useMemo(() => {
    const isOnline = (id: string | null | undefined) => !!id && !!seen[id] && now - new Date(seen[id]).getTime() < ONLINE_MS;
    const status = (id: string | null | undefined) => {
      if (!id) return "Offline";
      if (isOnline(id)) return "Online";
      const at = seen[id];
      if (!at) return "Offline";
      const min = Math.round((now - new Date(at).getTime()) / 60_000);
      if (min < 60) return `Visto ${min} min fa`;
      if (min < 24 * 60) return `Visto ${Math.round(min / 60)} h fa`;
      return `Visto il ${new Date(at).toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" })}`;
    };
    const onlineCount = Object.keys(seen).filter(isOnline).length;
    return { isOnline, status, onlineCount };
  }, [seen, now]);
}
