"use client";

import { usePathname } from "next/navigation";

/** La dashboard ha ricerca, notifiche e profilo dentro il riquadro di benvenuto: lì la barra non serve */
export function TopBar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return children;
}
