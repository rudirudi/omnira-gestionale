"use client";

import * as React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, Loader2, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCurrentUser } from "@/components/layout/user-context";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const SUGGESTIONS = [
  "Come stiamo oggi?",
  "Quali task sono in ritardo?",
  "Chi ci deve ancora pagare?",
  "Quanto abbiamo speso il mese scorso e in cosa?",
  "Cosa scade nei prossimi 60 giorni?",
  "Quanto ci costano gli abbonamenti al mese?",
];

export function Assistant() {
  const me = useCurrentUser();
  const storeKey = `omnira-assistente-${me.id}`;
  const [open, setOpen] = React.useState(false);
  // Conversazione ricordata su questo browser (solo comodità, non condivisa).
  // Il pannello parte chiuso, quindi leggere qui non cambia l'HTML del server.
  const [messages, setMessages] = React.useState<Msg[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(storeKey) ?? "[]") as Msg[];
    } catch {
      return [];
    }
  });
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (busy) return;
    try {
      localStorage.setItem(storeKey, JSON.stringify(messages.slice(-40)));
    } catch {}
  }, [messages, storeKey, busy]);
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  // Scorciatoia: Ctrl/Cmd + J apre l'assistente
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-assistant", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-assistant", onOpen);
    };
  }, []);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history: Msg[] = [...messages.filter((m) => !m.error), { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setStatus("Ci penso…");
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const append = (t: string) =>
      setMessages((ms) => {
        const copy = [...ms];
        const last = copy[copy.length - 1]!;
        copy[copy.length - 1] = { ...last, content: last.content + t };
        return copy;
      });

    try {
      const res = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-20).map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let sawText = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { type: string; text?: string; label?: string };
          if (ev.type === "text" && ev.text) {
            setStatus(null);
            sawText = true;
            append(ev.text);
          } else if (ev.type === "tool") {
            setStatus(`${ev.label}…`);
          } else if (ev.type === "break") {
            if (sawText) append("\n\n");
            sawText = false;
          } else if (ev.type === "error") {
            setMessages((ms) => [...ms.slice(0, -1), { role: "assistant", content: ev.text ?? "Errore", error: true }]);
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages((ms) => [...ms.slice(0, -1), { role: "assistant", content: "Non riesco a contattare l'assistente. Controlla la connessione e riprova.", error: true }]);
      }
    } finally {
      setBusy(false);
      setStatus(null);
      abortRef.current = null;
      // Risposta vuota (es. interrotta subito): la tolgo
      setMessages((ms) => (ms.length && ms[ms.length - 1]!.role === "assistant" && !ms[ms.length - 1]!.content ? ms.slice(0, -1) : ms));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Apri l'assistente"
        className="fixed right-5 bottom-5 z-40 flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[oklch(0.42_0.15_262)] to-[oklch(0.52_0.17_255)] pr-5 pl-4 text-[13px] font-semibold text-white shadow-lg ring-1 ring-white/20 transition-transform hover:-translate-y-0.5 hover:shadow-xl print:hidden"
      >
        <Sparkles className="size-5" /> <span className="hidden sm:inline">Chiedi all&apos;assistente</span>
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:bg-transparent" />
          <DialogPrimitive.Content
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-background shadow-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-right sm:w-[460px]"
            aria-describedby={undefined}
          >
            <header className="flex items-center gap-2.5 bg-gradient-to-r from-[oklch(0.35_0.12_262)] to-[oklch(0.45_0.15_262)] px-4 py-3 text-white">
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/15">
                <Sparkles className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-[14px] font-semibold">Assistente Omnira</DialogPrimitive.Title>
                <p className="text-[11px] text-white/70">Legge i dati del gestionale che puoi vedere tu · solo lettura</p>
              </div>
              {messages.length > 0 && (
                <button type="button" onClick={() => !busy && setMessages([])} className="rounded-md p-1.5 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Nuova conversazione" title="Nuova conversazione">
                  <RotateCcw className="size-4" />
                </button>
              )}
              <DialogPrimitive.Close className="rounded-md p-1.5 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Chiudi">
                <X className="size-4.5" />
              </DialogPrimitive.Close>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col gap-4 pt-4">
                  <p className="text-[15px] font-semibold">Ciao {me.fullName.split(" ")[0]}, cosa vuoi sapere?</p>
                  <p className="text-[13px] text-muted-foreground">Chiedimi di clienti, progetti, task, incassi, spese, abbonamenti, scadenze e preventivi.</p>
                  <div className="flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => ask(s)} className="rounded-lg border bg-card px-3 py-2 text-left text-[13px] transition-colors hover:border-primary/40 hover:bg-primary/[0.04]">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ul className="flex flex-col gap-4">
                  {messages.map((m, i) => (
                    <li key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      {m.role === "user" ? (
                        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[13px] whitespace-pre-wrap text-primary-foreground">{m.content}</p>
                      ) : (
                        <div className={cn("assistant-md max-w-full text-[13px] leading-relaxed", m.error && "rounded-lg bg-destructive/10 px-3 py-2 text-destructive")}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ href, children }) =>
                                href?.startsWith("/") ? (
                                  <Link href={href} onClick={() => setOpen(false)} className="font-medium text-primary underline-offset-2 hover:underline">
                                    {children}
                                  </Link>
                                ) : (
                                  <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                    {children}
                                  </a>
                                ),
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {status && (
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> {status}
                </p>
              )}
              <div ref={endRef} />
            </div>

            <form
              className="border-t p-3"
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
            >
              <div className="flex items-end gap-2 rounded-xl border bg-card p-1.5 focus-within:ring-2 focus-within:ring-primary/30">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ask(input);
                    }
                  }}
                  rows={1}
                  placeholder="Scrivi una domanda…"
                  aria-label="Domanda per l'assistente"
                  className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-[13px] outline-none [field-sizing:content]"
                />
                {busy ? (
                  <button type="button" onClick={() => abortRef.current?.abort()} className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground" aria-label="Ferma">
                    <Square className="size-3.5 fill-current" />
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim()} className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40" aria-label="Invia">
                    <ArrowUp className="size-4" />
                  </button>
                )}
              </div>
              <p className="mt-1.5 px-1 text-[10.5px] text-muted-foreground">Invio per mandare · Shift+Invio per andare a capo · Ctrl+J apre e chiude</p>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
