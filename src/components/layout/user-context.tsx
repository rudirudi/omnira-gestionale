"use client";

import * as React from "react";

export type CurrentUserInfo = { id: string; fullName: string; email: string; roleLabel: string; hiddenNav: string[] };

const Ctx = React.createContext<CurrentUserInfo | null>(null);

/** Dati dell'utente per i componenti client dell'intestazione (ricerca, notifiche, profilo) */
export function CurrentUserProvider({ value, children }: { value: CurrentUserInfo; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCurrentUser() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useCurrentUser fuori da CurrentUserProvider");
  return v;
}
