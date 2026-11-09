"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, File, FileArchive, FileImage, FileSpreadsheet, FileText, FileVideo, Loader2, Search, Trash2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FileCategory } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDate } from "@/lib/utils";
import { deleteFileAction, fileUrlAction, registerFileAction, updateFileAction } from "../actions";
import type { ProjectFile } from "../queries";

const BUCKET = "project-files";
const MAX = 50 * 1024 * 1024;

export const FILE_CATEGORY: Record<FileCategory, { label: string; cls: string }> = {
  documento: { label: "Documenti", cls: "bg-work/12 text-work-ink" },
  grafica: { label: "Grafica", cls: "bg-[oklch(0.55_0.17_300)]/12 text-[oklch(0.47_0.17_300)] dark:text-[oklch(0.8_0.1_300)]" },
  contratto: { label: "Contratti", cls: "bg-money/12 text-money-ink" },
  materiale_cliente: { label: "Dal cliente", cls: "bg-sales/20 text-sales-ink" },
  tecnico: { label: "Tecnici", cls: "bg-system/15 text-system-ink" },
  altro: { label: "Altro", cls: "bg-muted text-muted-foreground" },
};

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toLocaleString("it-IT", { maximumFractionDigits: 1 })} MB`;
}

function iconFor(mime: string | null, name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mime?.startsWith("image/")) return FileImage;
  if (mime?.startsWith("video/")) return FileVideo;
  if (/(xlsx?|csv|ods|numbers)$/.test(ext)) return FileSpreadsheet;
  if (/(zip|rar|7z|tar|gz)$/.test(ext)) return FileArchive;
  if (/(pdf|docx?|odt|txt|md|rtf|pages)$/.test(ext)) return FileText;
  return File;
}

/** Nome sicuro per il percorso (il nome originale resta nei dati) */
const safeName = (n: string) =>
  n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120) || "file";

type Upload = { key: string; name: string; size: number; state: "caricamento" | "fatto" | "errore"; error?: string };

export function ProjectFiles({ projectId, files, meId, isAdmin }: { projectId: string; files: ProjectFile[]; meId: string; isAdmin: boolean }) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const [category, setCategory] = React.useState<FileCategory>("documento");
  const [uploads, setUploads] = React.useState<Upload[]>([]);
  const [filter, setFilter] = React.useState<FileCategory | "tutti">("tutti");
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const busyUpload = uploads.some((u) => u.state === "caricamento");

  async function upload(list: FileList | File[]) {
    const items = Array.from(list);
    if (!items.length) return;
    const supabase = createClient();
    const queue: Upload[] = items.map((f) => ({ key: crypto.randomUUID(), name: f.name, size: f.size, state: f.size > MAX ? "errore" : "caricamento", error: f.size > MAX ? "Più di 50 MB" : undefined }));
    setUploads((u) => [...queue, ...u.filter((x) => x.state !== "fatto")]);
    const patch = (key: string, p: Partial<Upload>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...p } : x)));
    let ok = 0;
    await Promise.all(
      items.map(async (f, i) => {
        const key = queue[i].key;
        if (f.size > MAX) return;
        const path = `${projectId}/${key}-${safeName(f.name)}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
        if (error) return patch(key, { state: "errore", error: "Caricamento non riuscito" });
        const res = await registerFileAction(projectId, { path, name: f.name, size: f.size, mime: f.type || null, category });
        if (!res.ok) return patch(key, { state: "errore", error: res.error });
        ok += 1;
        patch(key, { state: "fatto" });
      }),
    );
    if (ok) {
      toast.success(ok === 1 ? "File caricato" : `${ok} file caricati`);
      router.refresh();
    }
  }

  async function open(f: ProjectFile, download: boolean) {
    // La finestra si apre subito (altrimenti il browser la blocca), poi riceve il link temporaneo
    const w = download ? null : window.open("", "_blank");
    setBusy(f.id);
    const res = await fileUrlAction(f.id, download);
    setBusy(null);
    if (!res.ok || !res.data) {
      w?.close();
      return toast.error(res.ok ? "Non riesco ad aprire il file" : res.error);
    }
    if (w) w.location.href = res.data;
    else window.location.href = res.data;
  }

  async function remove(f: ProjectFile) {
    setBusy(f.id);
    const res = await deleteFileAction(f.id);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    toast.success(res.message);
    router.refresh();
  }

  async function recategorize(f: ProjectFile, c: FileCategory) {
    const res = await updateFileAction(f.id, { category: c });
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }

  const counts = files.reduce<Record<string, number>>((m, f) => ((m[f.category] = (m[f.category] ?? 0) + 1), m), {});
  const shown = files.filter((f) => (filter === "tutti" || f.category === filter) && (!q.trim() || f.name.toLowerCase().includes(q.trim().toLowerCase())));
  const total = files.reduce((s, f) => s + f.size_bytes, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Caricamento */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-5 text-center transition-colors sm:flex-row sm:text-left",
          over ? "border-primary bg-primary/5" : "border-border bg-card",
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Upload className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">Trascina qui i file, oppure sceglili</p>
          <p className="text-[12.5px] text-muted-foreground">Qualsiasi tipo, fino a 50 MB ciascuno. Restano privati: li vede solo il team.</p>
        </div>
        <label className="flex items-center gap-2 text-[12.5px]">
          <span className="text-muted-foreground">Tipo</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as FileCategory)} className="h-9 rounded-md border bg-background px-2 text-[13px]">
            {(Object.keys(FILE_CATEGORY) as FileCategory[]).map((k) => (
              <option key={k} value={k}>
                {FILE_CATEGORY[k].label}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => input.current?.click()} disabled={busyUpload}>
          {busyUpload ? <Loader2 className="animate-spin" /> : <Upload />} Scegli file
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {uploads.map((u) => (
            <li key={u.key} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-[13px]">
              {u.state === "caricamento" ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : u.state === "fatto" ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <TriangleAlert className="size-4 text-destructive" />
              )}
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              <span className={cn("shrink-0 text-[12px]", u.state === "errore" ? "text-destructive" : "text-muted-foreground")}>
                {u.state === "errore" ? u.error : u.state === "fatto" ? "Caricato" : formatBytes(u.size)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Elenco */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border bg-card p-0.5 [scrollbar-width:none] [&>*]:shrink-0" role="group" aria-label="Filtra per tipo">
            {(["tutti", ...Object.keys(FILE_CATEGORY)] as (FileCategory | "tutti")[])
              .filter((k) => k === "tutti" || counts[k])
              .map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={filter === k}
                  onClick={() => setFilter(k)}
                  className={cn("h-7 rounded px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground", filter === k && "bg-muted text-foreground")}
                >
                  {k === "tutti" ? `Tutti (${files.length})` : `${FILE_CATEGORY[k].label} (${counts[k]})`}
                </button>
              ))}
          </div>
          <label className="relative ml-auto w-full sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca un file" aria-label="Cerca un file" className="h-8 w-full rounded-md border bg-background pr-2 pl-8 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
          </label>
        </div>
      )}

      {files.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">Nessun file ancora: contratti, grafiche, materiali del cliente, documenti tecnici.</p>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">Nessun file con questo filtro.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((f) => {
            const Icon = iconFor(f.mime, f.name);
            const canDelete = f.uploaded_by === meId || isAdmin;
            return (
              <li key={f.id} className="flex min-w-0 gap-3 rounded-xl border bg-card p-2.5 shadow-xs">
                <button type="button" onClick={() => void open(f, false)} className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted" aria-label={`Apri ${f.name}`}>
                  {f.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- link temporaneo dello spazio file privato
                    <img src={f.thumb} alt="" className="size-full object-cover" />
                  ) : (
                    <Icon className="size-6 text-muted-foreground" />
                  )}
                  {busy === f.id && (
                    <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                      <Loader2 className="size-4 animate-spin" />
                    </span>
                  )}
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <button type="button" onClick={() => void open(f, false)} className="truncate text-left text-[13.5px] font-semibold hover:underline" title={f.name}>
                    {f.name}
                  </button>
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    {formatBytes(f.size_bytes)} · {f.uploader?.full_name?.split(" ")[0] ?? "—"} · {formatDate(f.created_at)}
                  </p>
                  <div className="mt-auto flex items-center gap-1">
                    <select
                      value={f.category}
                      onChange={(e) => void recategorize(f, e.target.value as FileCategory)}
                      aria-label="Tipo di file"
                      className={cn("h-6 rounded-md border-0 px-1.5 text-[11px] font-semibold", FILE_CATEGORY[f.category].cls)}
                    >
                      {(Object.keys(FILE_CATEGORY) as FileCategory[]).map((k) => (
                        <option key={k} value={k}>
                          {FILE_CATEGORY[k].label}
                        </option>
                      ))}
                    </select>
                    <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => void open(f, true)} disabled={busy === f.id} aria-label={`Scarica ${f.name}`} title="Scarica">
                      <Download />
                    </Button>
                    {canDelete && <DeleteButton onConfirm={() => void remove(f)} disabled={busy === f.id} name={f.name} />}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {files.length > 0 && <p className="text-right text-[11.5px] text-muted-foreground">{files.length} file · {formatBytes(total)}</p>}
    </div>
  );
}

function DeleteButton({ onConfirm, disabled, name }: { onConfirm: () => void; disabled: boolean; name: string }) {
  const [confirm, setConfirm] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size={confirm ? "sm" : "icon-sm"}
      className={cn("text-muted-foreground", confirm && "text-destructive")}
      disabled={disabled}
      onBlur={() => setConfirm(false)}
      onClick={() => (confirm ? onConfirm() : setConfirm(true))}
      aria-label={confirm ? `Conferma eliminazione di ${name}` : `Elimina ${name}`}
      title="Elimina"
    >
      <Trash2 /> {confirm && "Elimina"}
    </Button>
  );
}
