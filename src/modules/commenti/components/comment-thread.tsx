"use client";

import * as React from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addCommentAction, type CommentWithAuthor, deleteCommentAction, fetchCommentsAction } from "../actions";

type Entity = "task" | "project" | "client" | "lead" | "discussion";

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "ora";
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  return new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Evidenzia le @menzioni note nel testo */
function renderBody(body: string, names: string[]) {
  if (!names.length) return body;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  const parts = body.split(new RegExp(`(@(?:${escaped.join("|")}))`, "g"));
  return parts.map((p, i) =>
    p.startsWith("@") && names.includes(p.slice(1)) ? (
      <span key={i} className="rounded bg-primary/10 px-0.5 font-medium text-primary">
        {p}
      </span>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  );
}

export function CommentThread({
  entityType,
  entityId,
  team,
  meId,
  isAdmin,
  className,
}: {
  entityType: Entity;
  entityId: string;
  team: { id: string; full_name: string }[];
  meId: string;
  isAdmin: boolean;
  className?: string;
}) {
  const [comments, setComments] = React.useState<{ key: string; items: CommentWithAuthor[] } | null>(null);
  const [text, setText] = React.useState("");
  const [mentioned, setMentioned] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState<string | null>(null);
  const [highlight, setHighlight] = React.useState(0);
  const [sending, startSend] = React.useTransition();
  const ref = React.useRef<HTMLTextAreaElement>(null);
  // posizione del cursore da ripristinare subito dopo l'inserimento di una menzione
  const pendingCaret = React.useRef<number | null>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (el && pendingCaret.current !== null) {
      el.focus();
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [text]);
  const key = `${entityType}:${entityId}`;

  const load = React.useCallback(() => {
    fetchCommentsAction(entityType, entityId).then((items) => setComments({ key, items }));
  }, [entityType, entityId, key]);
  React.useEffect(() => {
    load();
  }, [load]);

  const items = comments?.key === key ? comments.items : null;
  const suggestions = query === null ? [] : team.filter((m) => m.full_name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);
    const caret = e.target.selectionStart ?? value.length;
    const m = /(^|\s)@([\p{L}' ]{0,30})$/u.exec(value.slice(0, caret));
    setQuery(m ? m[2]! : null);
    setHighlight(0);
  }

  function pick(member: { id: string; full_name: string }) {
    const el = ref.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([\p{L}' ]{0,30})$/u, `@${member.full_name} `);
    const next = before + text.slice(caret);
    pendingCaret.current = before.length;
    setText(next);
    setMentioned((m) => [...new Set([...m, member.id])]);
    setQuery(null);
  }

  function submit() {
    const body = text.trim();
    if (!body) return;
    const mentions = mentioned.filter((id) => {
      const name = team.find((t) => t.id === id)?.full_name;
      return name && body.includes(`@${name}`);
    });
    startSend(async () => {
      const r = await addCommentAction({ entityType, entityId, body, mentions });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setText("");
      setMentioned([]);
      load();
    });
  }

  const names = team.map((t) => t.full_name);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {items === null ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carico i commenti…
        </p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nessun commento. Scrivi il primo; usa @ per menzionare un collega.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((c) => (
            <li key={c.id} className="group flex gap-3">
              <Avatar name={c.author?.full_name} className="mt-0.5 size-7" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-medium">{c.author?.full_name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
                  {(c.author_id === meId || isAdmin) && (
                    <button
                      type="button"
                      aria-label="Elimina commento"
                      className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={async () => {
                        const r = await deleteCommentAction(c.id);
                        if (r.ok) load();
                        else toast.error(r.error);
                      }}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed whitespace-pre-wrap">{renderBody(c.body, names)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Textarea
          ref={ref}
          value={text}
          onChange={onChange}
          rows={3}
          placeholder="Scrivi un commento… (@ per menzionare, Ctrl+Invio per inviare)"
          aria-label="Nuovo commento"
          onKeyDown={(e) => {
            if (suggestions.length) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => (h + 1) % suggestions.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                pick(suggestions[highlight]!);
                return;
              }
              if (e.key === "Escape") {
                setQuery(null);
                return;
              }
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {suggestions.length > 0 && (
          <ul role="listbox" aria-label="Menziona" className="absolute bottom-full left-0 z-20 mb-1 w-64 rounded-lg border bg-popover p-1 shadow-lg">
            {suggestions.map((m, i) => (
              <li key={m.id} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(m);
                  }}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]", i === highlight && "bg-muted")}
                >
                  <Avatar name={m.full_name} className="size-5 text-[9px]" />
                  {m.full_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={submit} disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />} Commenta
          </Button>
        </div>
      </div>
    </div>
  );
}
