"use client";

import * as React from "react";
import { CheckCircle2, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const noop = () => () => {};

/** "App sul telefono": pulsante Installa (Android/Chrome) o istruzioni (iPhone/Safari) */
export function InstallApp() {
  const [evt, setEvt] = React.useState<InstallEvent | null>(null);
  const [done, setDone] = React.useState(false);
  const standalone = React.useSyncExternalStore(
    noop,
    () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
  const ios = React.useSyncExternalStore(noop, () => /iphone|ipad|ipod/i.test(navigator.userAgent), () => false);

  React.useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const onInstalled = () => setDone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return (
    <section className="mt-8 max-w-3xl rounded-xl border bg-card p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <Smartphone className="size-4.5 text-primary" /> App sul telefono
      </h2>
      {standalone || done ? (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-money-ink">
          <CheckCircle2 className="size-4" /> Stai già usando il gestionale come app.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Aggiungi il gestionale alla schermata Home: si apre a schermo intero, con la sua icona, come un&apos;app.
          </p>
          {evt && (
            <Button
              className="mt-3"
              onClick={async () => {
                await evt.prompt();
                const r = await evt.userChoice;
                if (r.outcome === "accepted") setDone(true);
                setEvt(null);
              }}
            >
              <Download /> Installa l&apos;app
            </Button>
          )}
          <ul className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
            <li className={`rounded-lg border p-3 ${ios ? "border-primary bg-primary/5" : ""}`}>
              <strong className="block">iPhone / iPad (Safari)</strong>
              Tocca Condividi (il quadrato con la freccia), poi «Aggiungi alla schermata Home».
            </li>
            <li className={`rounded-lg border p-3 ${!ios ? "border-primary bg-primary/5" : ""}`}>
              <strong className="block">Android (Chrome)</strong>
              {evt ? "Usa il pulsante qui sopra, oppure" : "Apri"} il menu ⋮ e scegli «Installa app» o «Aggiungi a schermata Home».
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
