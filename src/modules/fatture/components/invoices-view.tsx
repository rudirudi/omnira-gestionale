"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, FileDown, FileText, FlaskConical, Inbox, Loader2, Plug, Plus, Printer, Search, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, formatDate, formatEuro } from "@/lib/utils";
import { checkInvoicingAction, setInvoicingModeAction } from "@/modules/impostazioni/actions";
import { importPurchaseFilesAction, registerPurchaseAction, setPurchaseStatusAction } from "../actions";
import { DOC_TYPES } from "../common";
import { EXPENSE_CATEGORIES, INVOICE_STATUS, PURCHASE_STATUS, invoiceNumber } from "../labels";
import type { InvoiceListItem, InvoicingInfo, PurchaseListItem } from "../queries";
import { RefreshButton } from "./invoice-actions";

type Project = { id: string; code: string | null; name: string; client_id: string | null };
const STATUS_FILTERS = [
  { v: "tutte", label: "Tutte" },
  { v: "bozze", label: "Bozze" },
  { v: "attesa", label: "In attesa SDI" },
  { v: "consegnate", label: "Consegnate" },
  { v: "correggere", label: "Da correggere" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["v"];

function matchStatus(s: string, f: StatusFilter) {
  if (f === "tutte") return true;
  if (f === "bozze") return s === "bozza";
  if (f === "attesa") return s === "in_invio" || s === "inviata";
  if (f === "consegnate") return s === "consegnata";
  return s === "scartata" || s === "errore" || s === "non_consegnata";
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "warning" | "danger" | "money" }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-l-4 bg-card px-4 py-3 shadow-xs",
        tone === "success" ? "border-l-success" : tone === "warning" ? "border-l-warning" : tone === "danger" ? "border-l-destructive" : "border-l-money",
      )}
    >
      <p className="text-[12.5px] text-muted-foreground">{label}</p>
      <p className="text-[20px] font-semibold tabular">{value}</p>
      {sub && <p className="text-[11.5px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function InvoicesView({
  invoices,
  purchases,
  info,
  projects,
  canManage,
  isAdmin,
  initialTab,
  today,
}: {
  invoices: InvoiceListItem[];
  purchases: PurchaseListItem[];
  info: InvoicingInfo;
  projects: Project[];
  canManage: boolean;
  isAdmin: boolean;
  initialTab: "emesse" | "ricevute";
  today: string;
}) {
  const [tab, setTabState] = React.useState(initialTab);
  const setTab = (t: "emesse" | "ricevute") => {
    setTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
  };
  const toRegister = purchases.filter((p) => p.status === "da_registrare").length;
  const toFix = invoices.filter((i) => ["scartata", "errore", "non_consegnata"].includes(i.status)).length;

  return (
    <div className="flex flex-col gap-4">
      <ConnectionBar info={info} isAdmin={isAdmin} canManage={canManage} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1" role="tablist">
          {(
            [
              ["emesse", `Emesse (${invoices.length})`, toFix],
              ["ricevute", `Ricevute (${purchases.length})`, toRegister],
            ] as const
          ).map(([k, label, badge]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn("flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground", tab === k && "bg-money text-white hover:text-white")}
            >
              {label}
              {badge > 0 && <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", tab === k ? "bg-white/25" : "bg-destructive text-white")}>{badge}</span>}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {info.ready && <RefreshButton label="Aggiorna dallo SDI" />}
          {canManage && tab === "emesse" && (
            <Button asChild className="bg-money hover:bg-money/90">
              <Link href="/fatture/nuova">
                <Plus /> Nuova fattura
              </Link>
            </Button>
          )}
          {canManage && tab === "ricevute" && <ImportButton />}
        </div>
      </div>
      {tab === "emesse" ? <IssuedList invoices={invoices} prefix={info.prefix} today={today} /> : <PurchaseList purchases={purchases} projects={projects} canManage={canManage} today={today} />}
    </div>
  );
}

function ConnectionBar({ info, isAdmin, canManage }: { info: InvoicingInfo; isAdmin: boolean; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [switching, setSwitching] = React.useState(false);
  const test = info.mode === "prova";
  const ok = info.ready && info.status?.ok;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-2.5 text-[13px]", test ? "border-warning bg-warning/10" : "border-success/40 bg-success/5")}>
      <span className="flex items-center gap-2 font-semibold">
        {test ? <FlaskConical className="size-4 text-warning-foreground" /> : <ShieldCheck className="size-4 text-success" />}
        {test ? "Modalità prova" : "Fatturazione reale"}
      </span>
      <span className="text-muted-foreground">
        {test ? "Le fatture vanno all'ambiente di test di Invoicetronic: non arrivano davvero ai clienti e hanno una numerazione a parte." : "Le fatture partono davvero verso lo SDI."}
      </span>
      <span className="flex items-center gap-1.5">
        <Plug className={cn("size-3.5", ok ? "text-success" : info.ready ? "text-warning-foreground" : "text-destructive")} />
        {!info.ready
          ? "Invoicetronic non collegato: manca la chiave nel Vault"
          : info.status?.ok
            ? `Collegato${typeof info.status.operation_left === "number" ? ` · ${info.status.operation_left} operazioni disponibili` : ""}`
            : info.status
              ? `Problema: ${info.status.detail ?? `errore ${info.status.code ?? ""}`}`
              : "Chiave presente, collegamento da verificare"}
      </span>
      {info.missing.length > 0 && (
        <Link href="/impostazioni?tab=azienda" className="flex items-center gap-1 font-medium text-destructive hover:underline">
          <AlertTriangle className="size-3.5" /> Mancano i dati fiscali dell&apos;azienda: {info.missing.join(", ")}
        </Link>
      )}
      <div className="ml-auto flex gap-2">
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await checkInvoicingAction();
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message);
                router.refresh();
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Plug />} Verifica collegamento
          </Button>
        )}
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setSwitching(true)}>
            {test ? "Passa al reale" : "Torna in prova"}
          </Button>
        )}
      </div>
      <Dialog open={switching} onOpenChange={setSwitching}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{test ? "Passare alla fatturazione reale?" : "Tornare in modalità prova?"}</DialogTitle>
            <DialogDescription>
              {test
                ? "Da questo momento le fatture inviate arrivano davvero ai clienti e all'Agenzia delle Entrate, con la numerazione ufficiale."
                : "Le prossime fatture andranno all'ambiente di test, con numerazione separata."}
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-1.5 pl-5 text-[13px]">
            {test ? (
              <>
                <li>
                  Nell&apos;editor SQL di Supabase sostituisci la chiave di test con quella <b>live</b>:
                  <code className="mt-1 block rounded bg-muted px-2 py-1 text-[11.5px]">
                    select vault.update_secret((select id from vault.secrets where name = &apos;invoicetronic_api_key&apos;), &apos;CHIAVE_LIVE&apos;);
                  </code>
                </li>
                <li>Controlla i dati fiscali in Impostazioni → Azienda (P.IVA, indirizzo, regime, IBAN, ultima fattura già emessa).</li>
                <li>Per ricevere le fatture dei fornitori, registra sul portale Fatture e Corrispettivi il codice destinatario di Invoicetronic.</li>
              </>
            ) : (
              <li>Rimetti nel Vault la chiave di test, altrimenti le prove partirebbero davvero.</li>
            )}
          </ol>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSwitching(false)}>
              Annulla
            </Button>
            <Button
              className={test ? "bg-success text-white hover:bg-success/90" : undefined}
              onClick={() =>
                start(async () => {
                  const r = await setInvoicingModeAction(test ? "reale" : "prova");
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(r.message);
                  setSwitching(false);
                  router.refresh();
                })
              }
            >
              {test ? "Ho messo la chiave live: attiva il reale" : "Torna in prova"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IssuedList({ invoices, prefix, today }: { invoices: InvoiceListItem[]; prefix: string; today: string }) {
  const [status, setStatus] = React.useState<StatusFilter>("tutte");
  const [client, setClient] = React.useState("");
  const years = [...new Set(invoices.map((i) => i.date.slice(0, 4)))].sort().reverse();
  const thisYear = today.slice(0, 4);
  const [year, setYear] = React.useState("");
  const [q, setQ] = React.useState("");
  const clients = [...new Map(invoices.filter((i) => i.client).map((i) => [i.client!.id, i.client!.name])).entries()].sort((a, b) => a[1].localeCompare(b[1], "it"));

  const real = invoices.filter((i) => !i.test && i.number && i.date.startsWith(thisYear) && ["inviata", "consegnata"].includes(i.status));
  const sign = (i: InvoiceListItem) => (i.doc_type === "TD04" ? -1 : 1);
  const billed = real.reduce((s, i) => s + sign(i) * i.total_cents, 0);
  const vat = real.reduce((s, i) => s + sign(i) * i.vat_cents, 0);
  const drafts = invoices.filter((i) => i.status === "bozza").length;
  const toFix = invoices.filter((i) => matchStatus(i.status, "correggere")).length;
  const waiting = invoices.filter((i) => matchStatus(i.status, "attesa")).length;

  const shown = invoices.filter(
    (i) =>
      matchStatus(i.status, status) &&
      (!client || i.client?.id === client) &&
      (!year || i.date.startsWith(year)) &&
      (!q.trim() || `${i.number ?? ""} ${i.client?.name ?? ""} ${i.causale ?? ""} ${i.project?.code ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={`Fatturato ${thisYear}`} value={formatEuro(billed)} sub={`IVA ${formatEuro(vat)} · ${real.length} fatture reali emesse`} />
        <Stat label="Bozze da inviare" value={String(drafts)} tone="warning" />
        <Stat label="In attesa dello SDI" value={String(waiting)} tone="success" sub="Di solito pochi minuti" />
        <Stat label="Da correggere" value={String(toFix)} tone="danger" sub={toFix ? "Scartate o non partite" : "Nessuna"} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border bg-card p-0.5 [scrollbar-width:none] [&>*]:shrink-0" role="group" aria-label="Filtra per stato">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.v}
              type="button"
              aria-pressed={status === f.v}
              onClick={() => setStatus(f.v)}
              className={cn("h-7 rounded px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground", status === f.v && "bg-muted text-foreground")}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select value={client} onChange={(e) => setClient(e.target.value)} aria-label="Filtra per cliente" className="h-8 max-w-[14rem] rounded-md border bg-card px-2 text-[13px]">
          <option value="">Tutti i clienti</option>
          {clients.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Anno" className="h-8 rounded-md border bg-card px-2 text-[13px]">
          <option value="">Tutti gli anni</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <label className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca" aria-label="Cerca fatture" className="h-8 w-full rounded-md border bg-background pr-2 pl-8 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
        </label>
      </div>
      {shown.length === 0 ? (
        <EmptyState
          area="money"
          icon={FileText}
          title={invoices.length ? "Nessuna fattura con questi filtri" : "Nessuna fattura ancora"}
          description={invoices.length ? "Prova un altro filtro." : "Crea la prima fattura, oppure parti da un importo in Incassi con «Emetti fattura»."}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((i) => {
            const st = INVOICE_STATUS[i.status];
            return (
              <li key={i.id}>
                <Link
                  href={`/fatture/${i.id}`}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-xl border border-l-4 bg-card px-4 py-3 shadow-xs transition-colors hover:border-money/50 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto_9rem]",
                    st.tone === "danger" ? "border-l-destructive" : st.tone === "success" ? "border-l-success" : st.tone === "warning" ? "border-l-warning" : st.tone === "primary" ? "border-l-primary" : "border-l-border",
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-[14px] font-semibold tabular">{invoiceNumber(i, prefix)}</span>
                    <span className="text-[12px] text-muted-foreground">{formatDate(i.date)}</span>
                  </div>
                  <div className="col-span-2 row-start-2 flex min-w-0 flex-col sm:col-span-1 sm:row-start-auto">
                    <span className="truncate text-[14px] font-medium">
                      {i.doc_type !== "TD01" && <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{DOC_TYPES[i.doc_type]}</span>}
                      {i.client?.name ?? "—"}
                    </span>
                    <span className="truncate text-[12px] text-muted-foreground">
                      {[i.project?.code, i.causale, i.status === "scartata" || i.status === "errore" ? i.sdi_message : null].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </div>
                  <span className={cn("text-right text-[15px] font-semibold tabular", i.doc_type === "TD04" && "text-destructive")}>
                    {i.doc_type === "TD04" ? "−" : ""}
                    {formatEuro(i.total_cents)}
                  </span>
                  <span className="flex flex-col items-end gap-1 justify-self-end">
                    <Badge dot tone={st.tone} title={st.hint}>
                      {st.label}
                    </Badge>
                    {i.test && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-warning-foreground">
                        <FlaskConical className="size-3" /> Prova
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ImportButton() {
  const router = useRouter();
  const ref = React.useRef<HTMLInputElement>(null);
  const [pending, start] = React.useTransition();
  return (
    <>
      <Button variant="outline" disabled={pending} onClick={() => ref.current?.click()} title="Fatture XML o .p7m scaricate dal portale dell'Agenzia delle Entrate">
        {pending ? <Loader2 className="animate-spin" /> : <Upload />} Importa XML
      </Button>
      <input
        ref={ref}
        type="file"
        multiple
        hidden
        accept=".xml,.p7m,application/xml,text/xml,application/pkcs7-mime"
        onChange={(e) => {
          const files = e.target.files;
          if (!files?.length) return;
          const fd = new FormData();
          for (const f of Array.from(files)) fd.append("files", f);
          e.target.value = "";
          start(async () => {
            const r = await importPurchaseFilesAction(fd);
            if (!r.ok) return void toast.error(r.error);
            toast.success(r.message, { description: r.data?.failed.length ? r.data.failed.slice(0, 5).join("\n") : undefined, duration: r.data?.failed.length ? 10000 : 4000 });
            router.refresh();
          });
        }}
      />
    </>
  );
}

const P_FILTERS = [
  { v: "tutte", label: "Tutte" },
  { v: "da_registrare", label: "Da registrare" },
  { v: "registrata", label: "Registrate" },
  { v: "pagata", label: "Pagate" },
  { v: "ignorata", label: "Ignorate" },
] as const;

function PurchaseList({ purchases, projects, canManage, today }: { purchases: PurchaseListItem[]; projects: Project[]; canManage: boolean; today: string }) {
  const [status, setStatus] = React.useState<(typeof P_FILTERS)[number]["v"]>("tutte");
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(null);
  const thisYear = today.slice(0, 4);
  const year = purchases.filter((p) => !p.test && p.doc_date?.startsWith(thisYear) && p.status !== "ignorata");
  const sign = (p: PurchaseListItem) => (p.doc_type === "TD04" ? -1 : 1);
  const soon = new Date(new Date(today).getTime() + 14 * 864e5).toISOString().slice(0, 10);
  const dueSoon = purchases.filter((p) => p.status !== "pagata" && p.status !== "ignorata" && p.due_date && p.due_date <= soon);
  const shown = purchases.filter(
    (p) => (status === "tutte" || p.status === status) && (!q.trim() || `${p.supplier_name ?? ""} ${p.number ?? ""} ${p.description ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())),
  );
  const current = purchases.find((p) => p.id === open) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={`Costi da fatture ${thisYear}`} value={formatEuro(year.reduce((s, p) => s + sign(p) * (p.total_cents ?? 0), 0))} sub={`IVA ${formatEuro(year.reduce((s, p) => s + sign(p) * (p.vat_cents ?? 0), 0))}`} />
        <Stat label="Da registrare" value={String(purchases.filter((p) => p.status === "da_registrare").length)} tone="warning" sub="Diventano spese con un clic" />
        <Stat
          label="Da pagare entro 14 giorni"
          value={formatEuro(dueSoon.reduce((s, p) => s + (p.total_cents ?? 0), 0))}
          tone="danger"
          sub={dueSoon.some((p) => p.due_date! < today) ? "Alcune sono già scadute" : dueSoon.length === 1 ? "1 fattura" : `${dueSoon.length} fatture`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border bg-card p-0.5 [scrollbar-width:none] [&>*]:shrink-0" role="group" aria-label="Filtra per stato">
          {P_FILTERS.map((f) => (
            <button
              key={f.v}
              type="button"
              aria-pressed={status === f.v}
              onClick={() => setStatus(f.v)}
              className={cn("h-7 rounded px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground", status === f.v && "bg-muted text-foreground")}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca fornitore o numero" aria-label="Cerca fatture ricevute" className="h-8 w-full rounded-md border bg-background pr-2 pl-8 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
        </label>
      </div>
      {shown.length === 0 ? (
        <EmptyState
          area="money"
          icon={Inbox}
          title={purchases.length ? "Nessuna fattura con questi filtri" : "Nessuna fattura ricevuta"}
          description={
            purchases.length
              ? "Prova un altro filtro."
              : "Arrivano da sole dallo SDI quando registrate il codice destinatario di Invoicetronic sul portale dell'Agenzia. Quelle già ricevute puoi importarle con «Importa XML»."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((p) => {
            const st = PURCHASE_STATUS[p.status];
            const late = p.due_date && p.due_date < today && p.status !== "pagata" && p.status !== "ignorata";
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setOpen(p.id)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-xl border bg-card px-4 py-3 text-left shadow-xs transition-colors hover:border-money/50 sm:grid-cols-[minmax(0,1fr)_8rem_auto_8rem]"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[14px] font-semibold">{p.supplier_name ?? "Fornitore sconosciuto"}</span>
                    <span className="truncate text-[12px] text-muted-foreground">
                      {p.doc_type === "TD04" ? "Nota di credito " : "Fattura "}
                      {p.number ? `n. ${p.number}` : ""} {p.doc_date ? `del ${formatDate(p.doc_date)}` : ""}
                      {p.description ? ` · ${p.description}` : ""}
                    </span>
                  </div>
                  <span className={cn("hidden text-[12px] sm:block", late ? "font-semibold text-destructive" : "text-muted-foreground")}>{p.due_date ? `Scade ${formatDate(p.due_date)}` : "—"}</span>
                  <span className={cn("text-right text-[15px] font-semibold tabular", p.doc_type === "TD04" && "text-success")}>
                    {p.doc_type === "TD04" ? "−" : ""}
                    {p.total_cents !== null ? formatEuro(p.total_cents) : "—"}
                  </span>
                  <span className="flex flex-col items-end gap-1 justify-self-end">
                    <Badge dot tone={st.tone}>
                      {st.label}
                    </Badge>
                    {p.test && <span className="text-[11px] font-semibold text-warning-foreground">Prova</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <PurchaseDialog purchase={current} projects={projects} canManage={canManage} onClose={() => setOpen(null)} />
    </div>
  );
}

function PurchaseDialog(props: { purchase: PurchaseListItem | null; projects: Project[]; canManage: boolean; onClose: () => void }) {
  if (!props.purchase) return null;
  return <PurchaseDialogBody key={props.purchase.id} {...props} purchase={props.purchase} />;
}

function PurchaseDialogBody({ purchase, projects, canManage, onClose }: { purchase: PurchaseListItem; projects: Project[]; canManage: boolean; onClose: () => void }) {
  const router = useRouter();
  const [category, setCategory] = React.useState("altro");
  const [project, setProject] = React.useState(purchase.project_id ?? "");
  const [paid, setPaid] = React.useState(false);
  const [pending, start] = React.useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, close = true) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      if (r.message) toast.success(r.message);
      if (close) onClose();
      router.refresh();
    });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{purchase.supplier_name ?? "Fattura ricevuta"}</DialogTitle>
          <DialogDescription>
            {purchase.doc_type === "TD04" ? "Nota di credito" : "Fattura"} {purchase.number ? `n. ${purchase.number}` : ""} {purchase.doc_date ? `del ${formatDate(purchase.doc_date)}` : ""}
            {purchase.supplier_vat ? ` · P.IVA ${purchase.supplier_vat}` : ""}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-[13px]">
          <div>
            <dt className="text-muted-foreground">Imponibile</dt>
            <dd className="font-semibold tabular">{purchase.net_cents !== null ? formatEuro(purchase.net_cents) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">IVA</dt>
            <dd className="font-semibold tabular">{purchase.vat_cents !== null ? formatEuro(purchase.vat_cents) : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Totale</dt>
            <dd className="text-[15px] font-semibold tabular">{purchase.total_cents !== null ? formatEuro(purchase.total_cents) : "—"}</dd>
          </div>
          {purchase.due_date && (
            <div className="col-span-3">
              <dt className="inline text-muted-foreground">Scadenza pagamento: </dt>
              <dd className="inline font-semibold">{formatDate(purchase.due_date)}</dd>
            </div>
          )}
          {purchase.description && <p className="col-span-3 text-[12.5px] text-muted-foreground">{purchase.description}</p>}
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/stampa/fattura-ricevuta/${purchase.id}`} target="_blank" rel="noreferrer">
              <Printer /> Vedi / stampa
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/fatture/xml?tipo=ricevuta&id=${purchase.id}`}>
              <Download /> Scarica XML
            </a>
          </Button>
        </div>
        {canManage && purchase.status === "da_registrare" && (
          <div className="flex flex-col gap-3 rounded-lg border border-money/30 bg-money/5 p-3">
            <p className="text-[13px] font-semibold">Registra come spesa</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[12.5px]">
                Categoria
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-[13px]">
                  {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12.5px]">
                Progetto (facoltativo)
                <select value={project} onChange={(e) => setProject(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-[13px]">
                  <option value="">Nessuno</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code ? `${p.code} · ` : ""}
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="size-4" /> Già pagata
            </label>
            <div className="flex flex-wrap gap-2">
              <Button className="bg-money hover:bg-money/90" disabled={pending} onClick={() => run(() => registerPurchaseAction(purchase.id, { category, project_id: project || null, paid }))}>
                {pending ? <Loader2 className="animate-spin" /> : <FileDown />} Registra spesa
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => run(() => setPurchaseStatusAction(purchase.id, "ignorata"))}>
                Ignora
              </Button>
            </div>
          </div>
        )}
        {canManage && purchase.status !== "da_registrare" && (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-muted-foreground">Stato:</span>
            <select value={purchase.status} onChange={(e) => run(() => setPurchaseStatusAction(purchase.id, e.target.value as PurchaseListItem["status"]), false)} className="h-8 rounded-md border bg-background px-2 text-[13px]">
              {Object.entries(PURCHASE_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            {purchase.expense_id && (
              <Link href="/spese" className="text-primary hover:underline">
                Vedi in Spese
              </Link>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

