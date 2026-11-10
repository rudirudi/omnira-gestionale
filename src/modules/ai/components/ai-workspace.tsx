"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Check,
  ClipboardCopy,
  Columns2,
  FileCode2,
  GitBranchPlus,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Rocket,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AiPromptKind, AiPromptStatus } from "@/lib/database.types";
import { cn, formatDate } from "@/lib/utils";
import { CommentThread } from "@/modules/commenti/components/comment-thread";
import {
  addVersionAction,
  createPromptAction,
  deletePromptAction,
  deleteVersionAction,
  saveVersionResultAction,
  setProductionAction,
  setPromptStatusAction,
  updatePromptAction,
} from "../actions";
import type { ProjectPrompt, PromptVersion } from "../queries";

export const KIND: Record<AiPromptKind, { label: string; hint: string }> = {
  system: { label: "System prompt", hint: "Istruzioni di base del modello" },
  prompt: { label: "Prompt", hint: "Richiesta per un compito" },
  agente: { label: "Agente", hint: "Istruzioni di un agente con strumenti" },
  template: { label: "Template", hint: "Testo con variabili {{…}}" },
  estrazione: { label: "Estrazione dati", hint: "Da documento a campi strutturati" },
  altro: { label: "Altro", hint: "" },
};

export const STATUS: Record<AiPromptStatus, { label: string; cls: string; dot: string }> = {
  bozza: { label: "Bozza", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  in_test: { label: "In test", cls: "bg-sales/20 text-sales-ink", dot: "bg-sales" },
  in_produzione: { label: "In produzione", cls: "bg-success/12 text-success", dot: "bg-success" },
  archiviato: { label: "Archiviato", cls: "bg-foreground/8 text-muted-foreground line-through", dot: "bg-foreground/30" },
};

const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-1"];

const tokens = (s: string) => Math.max(1, Math.round(s.length / 4));
const vars = (s: string) => [...new Set([...s.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map((m) => m[1]))];

type Team = { id: string; full_name: string }[];

export function AiWorkspace({
  projectId,
  prompts,
  team,
  meId,
  isAdmin,
  initialPrompt,
}: {
  projectId: string;
  prompts: ProjectPrompt[];
  team: Team;
  meId: string;
  isAdmin: boolean;
  initialPrompt?: string;
}) {
  const [selected, setSelected] = React.useState<string | null>(initialPrompt && prompts.some((p) => p.id === initialPrompt) ? initialPrompt : null);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<AiPromptStatus | "tutti">("tutti");
  const [creating, setCreating] = React.useState(false);
  const usedModels = [...new Set([...prompts.flatMap((p) => p.versions.map((v) => v.model).filter((m): m is string => !!m)), ...MODELS])];

  // sul computer si apre subito il primo prompt; sul telefono si parte dall'elenco
  const desktop = React.useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(min-width: 1024px)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );

  const select = (id: string | null) => {
    setSelected(id);
    const url = new URL(window.location.href);
    url.searchParams.set("scheda", "ai");
    if (id) url.searchParams.set("prompt", id);
    else url.searchParams.delete("prompt");
    window.history.replaceState(null, "", url);
  };

  const counts = prompts.reduce<Record<string, number>>((m, p) => ((m[p.status] = (m[p.status] ?? 0) + 1), m), {});
  const shown = prompts.filter(
    (p) =>
      (status === "tutti" || p.status === status) &&
      (!q.trim() || `${p.title} ${p.purpose ?? ""} ${p.versions[0]?.body ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())),
  );
  const current = prompts.find((p) => p.id === selected) ?? (desktop ? (shown[0] ?? prompts[0] ?? null) : null);

  if (!prompts.length && !creating) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-6" />
        </span>
        <div>
          <p className="text-[15px] font-semibold">Tutto quello che riguarda l&apos;AI del progetto</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
            Salva qui system prompt, prompt e istruzioni degli agenti. Ogni modifica diventa una variante: le provi, segni com&apos;è andata, le confronti e scegli quella da usare in produzione. Ogni prompt ha la sua discussione.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus /> Nuovo prompt
        </Button>
        <PromptDialog open={creating} onClose={() => setCreating(false)} projectId={projectId} models={usedModels} onCreated={select} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
      {/* Elenco */}
      <aside className={cn("flex min-w-0 flex-col gap-2", current && "max-lg:hidden")}>
        <Button onClick={() => setCreating(true)} className="w-full">
          <Plus /> Nuovo prompt
        </Button>
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca nei prompt"
            aria-label="Cerca nei prompt"
            className="h-8 w-full rounded-md border bg-background pr-2 pl-8 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtra per stato">
          {(["tutti", "bozza", "in_test", "in_produzione", "archiviato"] as const)
            .filter((k) => k === "tutti" || counts[k])
            .map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={status === k}
                onClick={() => setStatus(k)}
                className={cn(
                  "h-6 rounded-full border px-2 text-[11.5px] font-medium text-muted-foreground hover:text-foreground",
                  status === k && "border-primary bg-primary/8 text-primary",
                )}
              >
                {k === "tutti" ? `Tutti ${prompts.length}` : `${STATUS[k].label} ${counts[k]}`}
              </button>
            ))}
        </div>
        <ul className="scroll-brand flex flex-col gap-1.5 lg:max-h-[calc(100svh-22rem)] lg:min-h-80 lg:overflow-y-auto lg:pr-1">
          {shown.map((p) => {
            const prod = p.versions.find((v) => v.id === p.production_version_id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => select(p.id)}
                  aria-current={p.id === current?.id || undefined}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40",
                    p.id === current?.id && "border-primary bg-primary/5 ring-1 ring-primary/30",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", STATUS[p.status].dot)} title={STATUS[p.status].label} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{p.title}</span>
                  </span>
                  <span className="flex items-center gap-2 pl-4 text-[11.5px] text-muted-foreground">
                    <span>{KIND[p.kind].label}</span>
                    <span>·</span>
                    <span className="tabular">
                      {p.versions.length} {p.versions.length === 1 ? "versione" : "varianti"}
                    </span>
                    {prod && <span className="font-semibold text-success">· v{prod.number} live</span>}
                    {p.comments > 0 && (
                      <span className="ml-auto flex items-center gap-0.5">
                        <MessageSquare className="size-3" /> {p.comments}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {!shown.length && <li className="py-4 text-center text-[12.5px] text-muted-foreground">Nessun prompt con questo filtro.</li>}
        </ul>
      </aside>

      {/* Dettaglio */}
      <div className={cn("min-w-0", !current && "max-lg:hidden")}>
        {current ? (
          <PromptDetail key={current.id} projectId={projectId} prompt={current} team={team} meId={meId} isAdmin={isAdmin} models={usedModels} onBack={() => select(null)} onDeleted={() => select(null)} />
        ) : (
          <div className="flex h-full min-h-60 items-center justify-center rounded-xl border border-dashed text-[13px] text-muted-foreground">Scegli un prompt dall&apos;elenco</div>
        )}
      </div>
      <PromptDialog open={creating} onClose={() => setCreating(false)} projectId={projectId} models={usedModels} onCreated={select} />
    </div>
  );
}

function PromptDetail({
  projectId,
  prompt,
  team,
  meId,
  isAdmin,
  models,
  onBack,
  onDeleted,
}: {
  projectId: string;
  prompt: ProjectPrompt;
  team: Team;
  meId: string;
  isAdmin: boolean;
  models: string[];
  onBack: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const live = prompt.versions.find((v) => v.id === prompt.production_version_id);
  const [vid, setVid] = React.useState<string | undefined>(live?.id ?? prompt.versions[0]?.id);
  const version = prompt.versions.find((v) => v.id === vid) ?? prompt.versions[0];
  const [compare, setCompare] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [variant, setVariant] = React.useState(false);
  const [busy, start] = React.useTransition();
  const [confirmDel, setConfirmDel] = React.useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      if (r.message) toast.success(r.message);
      router.refresh();
    });

  const other = compare ? prompt.versions.find((v) => v.id === compare) : null;

  return (
    <section className="flex flex-col gap-4">
      {/* Testata del prompt */}
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <button type="button" onClick={onBack} className="mb-2 flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground lg:hidden">
          <ArrowLeft className="size-3.5" /> Tutti i prompt
        </button>
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {prompt.kind === "agente" ? <Bot className="size-5" /> : prompt.kind === "estrazione" || prompt.kind === "template" ? <FileCode2 className="size-5" /> : <Sparkles className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] leading-tight font-semibold">{prompt.title}</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {KIND[prompt.kind].label} · creato da {prompt.creator?.full_name?.split(" ")[0] ?? "—"} il {formatDate(prompt.created_at)}
            </p>
            {prompt.purpose && <p className="mt-2 text-[13px] whitespace-pre-line">{prompt.purpose}</p>}
          </div>
          <div className="flex items-center gap-1 max-sm:w-full max-sm:justify-end">
            <select
              value={prompt.status}
              onChange={(e) => run(() => setPromptStatusAction(projectId, prompt.id, e.target.value as AiPromptStatus))}
              aria-label="Stato del prompt"
              className={cn("h-7 rounded-md border-0 px-2 text-[12px] font-semibold", STATUS[prompt.status].cls)}
            >
              {(Object.keys(STATUS) as AiPromptStatus[]).map((k) => (
                <option key={k} value={k}>
                  {STATUS[k].label}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label="Modifica prompt" title="Modifica">
              <Pencil />
            </Button>
            {(isAdmin || prompt.created_by === meId) && (
              <Button
                variant="ghost"
                size={confirmDel ? "sm" : "icon-sm"}
                className={cn("text-muted-foreground", confirmDel && "text-destructive")}
                onBlur={() => setConfirmDel(false)}
                onClick={() =>
                  confirmDel
                    ? start(async () => {
                        const r = await deletePromptAction(projectId, prompt.id);
                        if (!r.ok) return void toast.error(r.error);
                        toast.success(r.message);
                        onDeleted();
                        router.refresh();
                      })
                    : setConfirmDel(true)
                }
                aria-label={confirmDel ? "Conferma eliminazione del prompt" : "Elimina prompt"}
                title="Elimina"
              >
                <Trash2 /> {confirmDel && "Elimina tutto"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Varianti */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border bg-card p-0.5 [scrollbar-width:none] [&>*]:shrink-0" role="tablist" aria-label="Varianti">
          {prompt.versions.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={v.id === version?.id}
              onClick={() => {
                setVid(v.id);
                if (compare === v.id) setCompare(null);
              }}
              className={cn(
                "flex h-7 items-center gap-1 rounded px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground",
                v.id === version?.id && "bg-primary text-primary-foreground hover:text-primary-foreground",
              )}
              title={v.label ?? undefined}
            >
              v{v.number}
              {v.label && <span className="max-w-32 truncate font-normal opacity-80">· {v.label}</span>}
              {v.id === prompt.production_version_id && <Rocket className="size-3" aria-label="in produzione" />}
              {v.rating && (
                <span className="flex items-center opacity-80">
                  <Star className="size-3 fill-current" />
                  {v.rating}
                </span>
              )}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => setVariant(true)}>
          <GitBranchPlus /> Nuova variante
        </Button>
        {prompt.versions.length > 1 && (
          <select
            value={compare ?? ""}
            onChange={(e) => setCompare(e.target.value || null)}
            aria-label="Confronta con"
            className="h-8 rounded-md border bg-background px-2 text-[12.5px]"
          >
            <option value="">Confronta con…</option>
            {prompt.versions
              .filter((v) => v.id !== version?.id)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.number}
                  {v.label ? ` · ${v.label}` : ""}
                </option>
              ))}
          </select>
        )}
      </div>

      {version && other ? (
        <Compare a={other} b={version} onClose={() => setCompare(null)} />
      ) : version ? (
        <VersionCard
          key={version.id}
          projectId={projectId}
          prompt={prompt}
          version={version}
          busy={busy}
          onProduction={(on) => run(() => setProductionAction(projectId, prompt.id, on ? version.id : null))}
          onDelete={() =>
            start(async () => {
              const r = await deleteVersionAction(projectId, version.id);
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.message);
              setVid(undefined);
              router.refresh();
            })
          }
        />
      ) : null}

      {/* Discussione */}
      <div className="rounded-xl border bg-card p-4 shadow-xs">
        <h4 className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
          <MessageSquare className="size-4 text-primary" /> Discussione su questo prompt
        </h4>
        <CommentThread entityType="ai_prompt" entityId={prompt.id} team={team} meId={meId} isAdmin={isAdmin} />
      </div>

      <PromptDialog open={editing} onClose={() => setEditing(false)} projectId={projectId} models={models} prompt={prompt} />
      <VersionDialog
        open={variant}
        onClose={() => setVariant(false)}
        projectId={projectId}
        promptId={prompt.id}
        from={version}
        models={models}
        onCreated={(id) => setVid(id)}
      />
    </section>
  );
}

function VersionCard({
  projectId,
  prompt,
  version,
  busy,
  onProduction,
  onDelete,
}: {
  projectId: string;
  prompt: ProjectPrompt;
  version: PromptVersion;
  busy: boolean;
  onProduction: (on: boolean) => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const isLive = version.id === prompt.production_version_id;
  const [copied, setCopied] = React.useState(false);
  const [rating, setRating] = React.useState<number | null>(version.rating);
  const [result, setResult] = React.useState(version.result ?? "");
  const [saving, startSave] = React.useTransition();
  const dirty = rating !== version.rating || result !== (version.result ?? "");
  const v = vars(version.body);

  const copy = async () => {
    await navigator.clipboard.writeText(version.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs", isLive && "border-success/50")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/40 px-4 py-2 text-[12px] text-muted-foreground">
        <span className="font-semibold text-foreground">
          v{version.number}
          {version.label ? ` · ${version.label}` : ""}
        </span>
        {isLive && (
          <span className="flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-semibold text-success">
            <Rocket className="size-3" /> In produzione
          </span>
        )}
        {version.model && <span className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px]">{version.model}</span>}
        {version.temperature !== null && <span>temp. {String(version.temperature).replace(".", ",")}</span>}
        {version.max_tokens && <span>max {version.max_tokens.toLocaleString("it-IT")} token</span>}
        <span className="ml-auto">
          {version.author?.full_name?.split(" ")[0] ?? "—"} · {formatDate(version.created_at)}
        </span>
      </div>
      {version.change_note && (
        <p className="border-b px-4 py-2 text-[12.5px]">
          <span className="font-semibold">Cosa cambia: </span>
          {version.change_note}
        </p>
      )}
      <div className="relative">
        <pre className="scroll-brand max-h-[28rem] overflow-auto px-4 pt-11 pb-3 font-mono sm:pt-3 sm:pr-28 text-[12.5px] leading-relaxed whitespace-pre-wrap">
          <Highlighted body={version.body} />
        </pre>
        <Button size="sm" variant="secondary" onClick={() => void copy()} className="absolute top-2 right-3 h-7 shadow-xs">
          {copied ? <Check /> : <ClipboardCopy />} {copied ? "Copiato" : "Copia"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2 text-[11.5px] text-muted-foreground">
        <span className="tabular">
          {version.body.length.toLocaleString("it-IT")} caratteri · ~{tokens(version.body).toLocaleString("it-IT")} token
        </span>
        {v.length > 0 && (
          <span className="flex flex-wrap items-center gap-1">
            · Variabili:
            {v.map((x) => (
              <code key={x} className="rounded bg-primary/10 px-1 text-primary">{`{{${x}}}`}</code>
            ))}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {prompt.versions.length > 1 && (
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onDelete} disabled={busy || isLive} title={isLive ? "È in produzione" : "Elimina questa variante"}>
              <Trash2 /> Elimina variante
            </Button>
          )}
          <Button size="sm" variant={isLive ? "outline" : "default"} className={cn(!isLive && "bg-success text-white hover:bg-success/90")} onClick={() => onProduction(!isLive)} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Rocket />} {isLive ? "Togli dalla produzione" : "Metti in produzione"}
          </Button>
        </div>
      </div>

      {/* Esito del test */}
      <div className="flex flex-col gap-2 border-t bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold">Com&apos;è andata</span>
          <div className="flex" role="radiogroup" aria-label="Valutazione">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} su 5`}
                onClick={() => setRating(rating === n ? null : n)}
                className="p-0.5 text-sales-ink"
              >
                <Star className={cn("size-4", rating && n <= rating ? "fill-sales text-sales" : "text-muted-foreground/50")} />
              </button>
            ))}
          </div>
        </div>
        <Textarea
          value={result}
          onChange={(e) => setResult(e.target.value)}
          rows={2}
          maxLength={10000}
          aria-label="Esito del test"
          placeholder="Risultati dei test: cosa ha fatto bene, cosa sbaglia, esempi di input che lo mandano in crisi…"
          className="bg-background text-[13px]"
        />
        {dirty && (
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={saving}
              onClick={() =>
                startSave(async () => {
                  const r = await saveVersionResultAction(projectId, version.id, { result, rating });
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(r.message);
                  router.refresh();
                })
              }
            >
              {saving && <Loader2 className="animate-spin" />} Salva esito
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Highlighted({ body }: { body: string }) {
  const parts = body.split(/(\{\{\s*[\w.-]+\s*\}\})/g);
  return parts.map((p, i) =>
    /^\{\{/.test(p) ? (
      <span key={i} className="rounded bg-primary/10 text-primary">
        {p}
      </span>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  );
}

/** Differenze riga per riga (LCS) tra due varianti */
function diffLines(a: string, b: string) {
  const x = a.split("\n");
  const y = b.split("\n");
  const n = x.length;
  const m = y.length;
  if (n * m > 4_000_000) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { t: "=" | "-" | "+"; s: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      out.push({ t: "=", s: x[i++] });
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: "-", s: x[i++] });
    else out.push({ t: "+", s: y[j++] });
  }
  while (i < n) out.push({ t: "-", s: x[i++] });
  while (j < m) out.push({ t: "+", s: y[j++] });
  return out;
}

function Compare({ a, b, onClose }: { a: PromptVersion; b: PromptVersion; onClose: () => void }) {
  const diff = React.useMemo(() => diffLines(a.body, b.body), [a.body, b.body]);
  const added = diff?.filter((d) => d.t === "+").length ?? 0;
  const removed = diff?.filter((d) => d.t === "-").length ?? 0;
  const fmt = (v: string | number | null) => (v === null ? "—" : String(v).replace(".", ","));
  const meta = (k: "model" | "temperature" | "max_tokens", label: string) =>
    a[k] !== b[k] ? (
      <span key={k}>
        {label}: <span className="text-destructive line-through">{fmt(a[k])}</span> → <span className="font-semibold text-success">{fmt(b[k])}</span>
      </span>
    ) : null;
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/40 px-4 py-2 text-[12px]">
        <Columns2 className="size-4 text-primary" />
        <span className="font-semibold">
          v{a.number} → v{b.number}
        </span>
        <span className="text-success">+{added} righe</span>
        <span className="text-destructive">−{removed} righe</span>
        <span className="flex flex-wrap gap-x-3 text-muted-foreground">
          {meta("model", "Modello")}
          {meta("temperature", "Temperatura")}
          {meta("max_tokens", "Max token")}
        </span>
        <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={onClose}>
          Chiudi confronto
        </Button>
      </div>
      {(a.rating || b.rating || a.result || b.result) && (
        <div className="grid gap-px border-b bg-border text-[12px] sm:grid-cols-2">
          {[a, b].map((v) => (
            <div key={v.id} className="bg-card px-4 py-2">
              <span className="font-semibold">v{v.number}</span> {v.rating ? `· ${"★".repeat(v.rating)}${"☆".repeat(5 - v.rating)}` : "· non valutata"}
              {v.result && <p className="mt-0.5 line-clamp-3 text-muted-foreground">{v.result}</p>}
            </div>
          ))}
        </div>
      )}
      {diff ? (
        <pre className="scroll-brand max-h-[32rem] overflow-auto py-2 font-mono text-[12.5px] leading-relaxed">
          {diff.map((d, i) => (
            <div
              key={i}
              className={cn(
                "px-4 whitespace-pre-wrap",
                d.t === "+" && "bg-success/10 text-success",
                d.t === "-" && "bg-destructive/8 text-destructive line-through decoration-destructive/40",
              )}
            >
              <span className="mr-2 inline-block w-3 select-none opacity-60">{d.t === "=" ? " " : d.t === "+" ? "+" : "−"}</span>
              {d.s || " "}
            </div>
          ))}
        </pre>
      ) : (
        <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">I testi sono troppo lunghi per il confronto riga per riga.</p>
      )}
    </div>
  );
}

type VersionForm = { label: string; body: string; model: string; temperature: string; max_tokens: string; change_note: string };
const fromVersion = (v?: PromptVersion | null): VersionForm => ({
  label: "",
  body: v?.body ?? "",
  model: v?.model ?? "",
  temperature: v?.temperature === null || v?.temperature === undefined ? "" : String(v.temperature).replace(".", ","),
  max_tokens: v?.max_tokens ? String(v.max_tokens) : "",
  change_note: "",
});

function VersionFields({ form, set, errors, models, first }: { form: VersionForm; set: (k: keyof VersionForm, v: string) => void; errors: Record<string, string[] | undefined>; models: string[]; first?: boolean }) {
  return (
    <>
      {!first && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome della variante" htmlFor="v_label" error={errors.label} hint="Facoltativo, es. «Più conciso», «Con esempi»">
            <Input id="v_label" value={form.label} onChange={(e) => set("label", e.target.value)} maxLength={120} />
          </Field>
          <Field label="Cosa cambia" htmlFor="v_change" error={errors.change_note} hint="Perché la provi">
            <Input id="v_change" value={form.change_note} onChange={(e) => set("change_note", e.target.value)} maxLength={2000} />
          </Field>
        </div>
      )}
      <Field label="Testo del prompt *" htmlFor="v_body" error={errors.body} hint={`Usa {{variabile}} per le parti che cambiano. ~${tokens(form.body || " ").toLocaleString("it-IT")} token`}>
        <Textarea id="v_body" value={form.body} onChange={(e) => set("body", e.target.value)} rows={12} maxLength={100000} className="font-mono text-[12.5px]" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Modello" htmlFor="v_model" error={errors.model}>
          <Input id="v_model" list="ai-models" value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="es. claude-sonnet-5-5" />
          <datalist id="ai-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field label="Temperatura" htmlFor="v_temp" error={errors.temperature} hint="Da 0 a 2">
          <Input id="v_temp" inputMode="decimal" value={form.temperature} onChange={(e) => set("temperature", e.target.value)} placeholder="es. 0,2" />
        </Field>
        <Field label="Max token" htmlFor="v_max" error={errors.max_tokens}>
          <Input id="v_max" inputMode="numeric" value={form.max_tokens} onChange={(e) => set("max_tokens", e.target.value)} placeholder="es. 2000" />
        </Field>
      </div>
    </>
  );
}

function PromptDialog({
  open,
  onClose,
  projectId,
  models,
  prompt,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  models: string[];
  prompt?: ProjectPrompt;
  onCreated?: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{prompt ? "Modifica prompt" : "Nuovo prompt"}</DialogTitle>
          <DialogDescription>{prompt ? "Nome, tipo e scopo. Il testo si cambia creando una nuova variante." : "Niente chiavi API o password: solo testi e impostazioni."}</DialogDescription>
        </DialogHeader>
        {open && <PromptForm projectId={projectId} models={models} prompt={prompt} onDone={onClose} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  );
}

function PromptForm({ projectId, models, prompt, onDone, onCreated }: { projectId: string; models: string[]; prompt?: ProjectPrompt; onDone: () => void; onCreated?: (id: string) => void }) {
  const router = useRouter();
  const [title, setTitle] = React.useState(prompt?.title ?? "");
  const [kind, setKind] = React.useState<AiPromptKind>(prompt?.kind ?? "system");
  const [purpose, setPurpose] = React.useState(prompt?.purpose ?? "");
  const [form, setForm] = React.useState<VersionForm>(fromVersion(null));
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [pending, start] = React.useTransition();

  const save = () =>
    start(async () => {
      const r = prompt
        ? await updatePromptAction(projectId, prompt.id, { title, kind, purpose })
        : await createPromptAction(projectId, { title, kind, purpose, version: form });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        return void toast.error(r.error);
      }
      toast.success(r.message);
      if (!prompt && "data" in r && typeof r.data === "string") onCreated?.(r.data);
      router.refresh();
      onDone();
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <Field label="Nome *" htmlFor="p_title" error={errors.title}>
          <Input id="p_title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="es. Estrazione dati fattura" autoFocus />
        </Field>
        <Field label="Tipo" htmlFor="p_kind" hint={KIND[kind].hint}>
          <select id="p_kind" value={kind} onChange={(e) => setKind(e.target.value as AiPromptKind)} className="h-9 rounded-md border bg-background px-2 text-[13.5px]">
            {(Object.keys(KIND) as AiPromptKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND[k].label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="A cosa serve" htmlFor="p_purpose" error={errors.purpose} hint="Dove si usa nel progetto, input e output attesi">
        <Textarea id="p_purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} maxLength={1000} />
      </Field>
      {!prompt && <VersionFields first form={form} set={(k, v) => setForm((f) => ({ ...f, [k]: v }))} errors={errors} models={models} />}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          Annulla
        </Button>
        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} {prompt ? "Salva" : "Crea prompt"}
        </Button>
      </div>
    </div>
  );
}

function VersionDialog({
  open,
  onClose,
  projectId,
  promptId,
  from,
  models,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  promptId: string;
  from?: PromptVersion;
  models: string[];
  onCreated: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuova variante</DialogTitle>
          <DialogDescription>{from ? `Parte dal testo di v${from.number}: modificalo e salva. La versione di partenza resta com'è.` : "Scrivi il nuovo testo."}</DialogDescription>
        </DialogHeader>
        {open && <VersionForm projectId={projectId} promptId={promptId} from={from} models={models} onDone={onClose} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  );
}

function VersionForm({ projectId, promptId, from, models, onDone, onCreated }: { projectId: string; promptId: string; from?: PromptVersion; models: string[]; onDone: () => void; onCreated: (id: string) => void }) {
  const router = useRouter();
  const [form, setForm] = React.useState<VersionForm>(fromVersion(from));
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [pending, start] = React.useTransition();
  const unchanged = from && form.body.trim() === from.body.trim() && form.model === (from.model ?? "") && form.temperature === fromVersion(from).temperature && form.max_tokens === fromVersion(from).max_tokens;
  const save = () =>
    start(async () => {
      const r = await addVersionAction(projectId, promptId, form);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        return void toast.error(r.error);
      }
      toast.success(r.message);
      if (r.data) onCreated(r.data);
      router.refresh();
      onDone();
    });
  return (
    <div className="flex flex-col gap-4">
      <VersionFields form={form} set={(k, v) => setForm((f) => ({ ...f, [k]: v }))} errors={errors} models={models} />
      <div className="flex items-center justify-end gap-2">
        {unchanged && <span className="mr-auto text-[12px] text-muted-foreground">Uguale a v{from?.number}: cambia qualcosa prima di salvare.</span>}
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          Annulla
        </Button>
        <Button onClick={save} disabled={pending || !!unchanged}>
          {pending && <Loader2 className="animate-spin" />} Salva variante
        </Button>
      </div>
    </div>
  );
}
