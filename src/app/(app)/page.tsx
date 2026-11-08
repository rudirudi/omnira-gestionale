import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Target,
  UserPlus,
  TrendingUp,
  Users,
  Wallet,
  CalendarClock as CalendarIcon,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { ExpandableStrip, StripPill } from "@/components/app/expandable-strip";
import { PageBody } from "@/components/app/page-header";
import { HeaderMenuButton, HeaderTools } from "@/components/layout/header-tools";
import { Badge } from "@/components/ui/badge";
import { AREA, type Area } from "@/lib/areas";
import { getCurrentUser } from "@/lib/auth";
import { LEAD_STAGE, LEAD_STAGES, TASK_STATUS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { cn, formatEuro } from "@/lib/utils";
import { getDashboardData } from "@/modules/dashboard/queries";
import { dueInfo, DueLabel, PriorityFlag } from "@/modules/task/components/task-meta";
import { UnassignedTasks } from "@/modules/task/components/unassigned-tasks";
import { listActiveTeam } from "@/modules/team/queries";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(new Date().toLocaleString("it-IT", { hour: "numeric", hour12: false, timeZone: "Europe/Rome" }));
  return h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
}

/** Importo in euro senza centesimi, per i numeri grandi delle card */
const euroWhole = (cents: number) =>
  (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" } as Intl.NumberFormatOptions);

/** Colori dell'area sullo sfondo blu dell'intestazione */
const GLASS: Record<Area, { chip: string; bar: string }> = {
  work: { chip: "bg-[oklch(0.6_0.16_255)] text-white", bar: "bg-[oklch(0.72_0.14_250)]" },
  sales: { chip: "bg-sales text-on-warning", bar: "bg-sales" },
  money: { chip: "bg-[oklch(0.6_0.15_150)] text-white", bar: "bg-[oklch(0.75_0.16_150)]" },
  support: { chip: "bg-support text-white", bar: "bg-[oklch(0.7_0.18_25)]" },
  system: { chip: "bg-white/20 text-white", bar: "bg-white/40" },
};

const STAGE_BAR: Record<string, string> = {
  nuovo: "bg-muted-foreground/40",
  call: "bg-primary/60",
  analisi: "bg-primary",
  preventivo: "bg-warning",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const showMoney = can.viewMoney(user.role);
  const [d, team] = await Promise.all([getDashboardData(user.id, showMoney), listActiveTeam()]);
  const firstName = user.full_name.split(" ")[0];
  const today = new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" });
  const lateTasks = d.myTasks.filter((t) => dueInfo(t.due_date, t.status)?.late).length;
  const todayTasks = d.myTasks.filter((t) => dueInfo(t.due_date, t.status)?.diff === 0).length;
  const openStages = LEAD_STAGES.filter((s) => s.value !== "vinto" && s.value !== "perso");
  const pipelineTotal = Math.max(1, d.pipelineCents);
  const lateDue = d.due.filter((a) => new Date(a.due_at!) < new Date()).length;

  // I miei task divisi per urgenza: colori forti dove serve agire subito
  const byDiff = (fn: (diff: number | null) => boolean) => d.myTasks.filter((t) => fn(dueInfo(t.due_date, t.status)?.diff ?? null));
  const taskGroups = [
    { key: "ritardo", label: "In ritardo", items: byDiff((x) => x !== null && x < 0), empty: "Nessun ritardo 👏", bg: "bg-destructive/[0.06]", dot: "bg-destructive", text: "text-destructive", count: "bg-destructive text-white", bar: "border-l-destructive" },
    { key: "oggi", label: "Oggi e domani", items: byDiff((x) => x === 0 || x === 1), empty: "Niente in scadenza", bg: "bg-warning/[0.12]", dot: "bg-warning", text: "text-sales-ink", count: "bg-warning text-on-warning", bar: "border-l-warning" },
    { key: "settimana", label: "Prossimi 7 giorni", items: byDiff((x) => x !== null && x >= 2 && x <= 7), empty: "Settimana libera", bg: "bg-work/[0.06]", dot: "bg-work", text: "text-work-ink", count: "bg-work text-white", bar: "border-l-work" },
    { key: "dopo", label: "Più avanti / senza data", items: byDiff((x) => x === null || x > 7), empty: "Niente in coda", bg: "bg-muted/60", dot: "bg-muted-foreground/50", text: "text-muted-foreground", count: "bg-muted-foreground/20 text-foreground", bar: "border-l-muted-foreground/30" },
  ];

  const kpis: { label: string; value: string; sub: string; icon: typeof Users; href: string; area: Area }[] = [
    { label: "I miei task aperti", value: d.myTasks.length === 40 ? "40+" : String(d.myTasks.length), sub: lateTasks ? `${lateTasks} in ritardo` : "nessun ritardo", icon: CheckSquare, href: "/task?miei=1", area: "work" },
    { label: "Progetti attivi", value: String(d.activeProjects), sub: "in lavorazione", icon: Briefcase, href: "/progetti?stato=attivo", area: "work" },
    { label: "Clienti attivi", value: String(d.activeClients), sub: `${d.openLeads} lead aperti`, icon: Users, href: "/clienti?stato=attivo", area: "sales" },
    showMoney
      ? { label: "Da incassare", value: euroWhole(d.toCollectCents), sub: d.overdueCents ? `${formatEuro(d.overdueCents)} scaduti` : "nessun ritardo", icon: Wallet, href: "/incassi", area: "money" }
      : { label: "Vinti questo mese", value: euroWhole(d.wonMonthCents), sub: `${d.wonMonthCount} lead chiusi`, icon: TrendingUp, href: "/lead", area: "money" },
  ];

  return (
    <PageBody className="flex flex-col gap-6">
      {/* Benvenuto */}
      <section data-hero className="relative -mx-4 -mt-6 overflow-hidden border-white/60 bg-sidebar px-5 pt-5 pb-5 text-sidebar-foreground sm:-mx-6 sm:px-7 sm:pb-6 lg:border-l">
        <div className="absolute -top-20 -right-16 size-72 rounded-full bg-white/[0.06]" aria-hidden />
        <div className="absolute -bottom-24 right-40 size-56 rounded-full bg-white/[0.04]" aria-hidden />
        <div className="relative flex items-center gap-2">
          <HeaderMenuButton onDark />
          <p className="text-[13px] font-medium text-sidebar-muted first-letter:uppercase">{today}</p>
          <div className="ml-auto" data-tools>
            <HeaderTools onDark />
          </div>
        </div>
        <div className="relative mt-5 flex flex-col gap-5 sm:mt-6 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
          <div className="min-w-0">
            <h1 className="text-[28px] leading-tight font-semibold">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-sidebar-foreground/85">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-warning" /> {todayTasks} task in scadenza oggi
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", lateTasks ? "bg-destructive" : "bg-success")} />
                {lateTasks ? `${lateTasks} in ritardo` : "nessun task in ritardo"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[oklch(0.8_0.1_250)]" /> {d.due.length} promemoria questa settimana
              </span>
            </p>
          </div>

          {/* Numeri chiave dentro l'intestazione: riquadri "in vetro", colore dell'area su icona e filo in basso */}
          <div data-kpis className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-4 xl:w-[700px]">
            {kpis.map((k) => {
              const g = GLASS[k.area];
              return (
                <Link
                  key={k.label}
                  href={k.href}
                  className="group relative overflow-hidden rounded-xl bg-white/[0.07] px-3.5 pt-3 pb-3.5 ring-1 ring-white/[0.12] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/[0.12] hover:ring-white/25"
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg shadow-sm", g.chip)}>
                      <k.icon className="size-3.5" strokeWidth={2.2} aria-hidden />
                    </span>
                    <span className="truncate text-[12px] font-medium text-white/75">{k.label}</span>
                  </span>
                  <span className={cn("mt-2.5 block truncate leading-none font-semibold tracking-tight text-white tabular", k.value.length > 9 ? "text-[21px]" : "text-[26px]")}>{k.value}</span>
                  <span className="mt-1.5 flex items-center gap-1 text-[11.5px] text-white/60">
                    <span className="truncate">{k.sub}</span>
                    <ArrowRight className="ml-auto size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className={cn("absolute inset-x-0 bottom-0 h-[3px]", g.bar)} aria-hidden />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Strisce espandibili: promemoria (rosso) e pipeline (giallo) */}
      <div className="-mt-2 flex flex-col gap-2.5">
        <ExpandableStrip
          id="promemoria"
          icon={<Bell />}
          title="Promemoria"
          band={AREA.support.band}
          border={AREA.support.bandBorder}
          summary={
            d.due.length === 0 ? (
              <span>niente in programma questa settimana</span>
            ) : (
              <>
                {lateDue > 0 && <StripPill className="bg-white font-semibold text-[oklch(0.45_0.19_27)]">{lateDue} scadut{lateDue === 1 ? "o" : "i"}</StripPill>}
                {d.due.length - lateDue > 0 && <StripPill>{d.due.length - lateDue} questa settimana</StripPill>}
                <span className="hidden truncate lg:inline">{d.due[0]!.subject}{d.due.length > 1 ? "…" : ""}</span>
              </>
            )
          }
        >
          {d.due.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Aggiungi un promemoria dalla scheda di un cliente o di un lead (tab Attività).</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {d.due.map((a) => {
                const late = new Date(a.due_at!) < new Date();
                const href = a.client ? `/clienti/${a.client.id}?scheda=attivita` : `/lead?aperto=${a.lead_id}`;
                return (
                  <li key={a.id}>
                    <Link href={href} className={cn("flex items-start gap-3 rounded-lg border border-l-4 p-2.5 transition-colors hover:bg-muted/50", late ? "border-l-destructive bg-destructive/[0.04]" : "border-l-warning")}>
                      <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", late ? "bg-destructive/10 text-destructive" : "bg-warning/25 text-on-warning dark:text-warning")}>
                        {late ? <AlertTriangle className="size-3.5" /> : <CalendarClock className="size-3.5" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{a.subject}</p>
                        <p className={cn("truncate text-xs", late ? "font-medium text-destructive" : "text-muted-foreground")}>
                          {late ? "Scaduto · " : ""}
                          {new Date(a.due_at!).toLocaleString("it-IT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          {a.client ? ` · ${a.client.name}` : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </ExpandableStrip>

        <ExpandableStrip
          id="pipeline"
          icon={<Target />}
          title="Pipeline lead"
          band={AREA.sales.band}
          border={AREA.sales.bandBorder}
          href="/lead"
          linkLabel="Apri la pipeline"
          summary={
            <>
              <StripPill className="bg-white font-semibold text-[oklch(0.42_0.11_65)]">{formatEuro(d.pipelineCents)}</StripPill>
              <StripPill>{d.openLeads} lead aperti</StripPill>
              <span className="hidden h-2 w-40 overflow-hidden rounded-full bg-white/25 md:flex" aria-hidden>
                {openStages.map((s) => {
                  const v = d.pipelineByStage[s.value]?.value ?? 0;
                  return v ? <span key={s.value} className="h-full bg-white" style={{ width: `${(v / pipelineTotal) * 100}%`, opacity: 0.45 + openStages.indexOf(s) * 0.18 }} /> : null;
                })}
              </span>
            </>
          }
        >
          <div className="flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {openStages.map((s) => {
                const st = d.pipelineByStage[s.value];
                return (
                  <Link key={s.value} href="/lead" className="rounded-lg border p-3 transition-colors hover:bg-muted/50">
                    <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <span className={cn("size-2 rounded-full", STAGE_BAR[s.value])} /> {s.label}
                    </p>
                    <p className="mt-1.5 text-lg font-semibold tabular">{formatEuro(st?.value ?? 0)}</p>
                    <p className="text-xs text-muted-foreground tabular">{st?.count ?? 0} lead</p>
                  </Link>
                );
              })}
            </div>
            {d.recentLeads.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Ultimi arrivati</p>
                <ul className="flex flex-wrap gap-2">
                  {d.recentLeads.map((l) => (
                    <li key={l.id}>
                      <Link href={`/lead?aperto=${l.id}`} className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1.5 text-[13px] hover:bg-muted/60">
                        <Badge dot tone={LEAD_STAGE[l.stage].tone}>
                          {LEAD_STAGE[l.stage].label}
                        </Badge>
                        <span className="max-w-56 truncate font-medium">{l.title}</span>
                        <span className="text-muted-foreground tabular">{formatEuro(l.estimated_value_cents)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ExpandableStrip>
      </div>

      {/* Task senza assegnatario: da prendere in carico */}
      {d.unassignedCount > 0 && (
        <BandCard
          area="work"
          icon={UserPlus}
          title={`Da assegnare · ${d.unassignedCount} task senza nessuno`}
          href="/task?chi=nessuno"
          linkLabel={d.unassignedCount > d.unassigned.length ? `Vedi tutti (${d.unassignedCount})` : "Apri i task"}
        >
          <UnassignedTasks tasks={d.unassigned} people={team} meId={user.id} />
        </BandCard>
      )}

      {/* I miei task, divisi per urgenza */}
      <BandCard area="work" icon={CheckSquare} title={`I miei task · ${d.myTasks.length} aperti`} href="/task?miei=1" linkLabel="Tutti i miei task" bodyClassName="p-3 sm:p-4">
        {d.myTasks.length === 0 ? (
          <EmptyState area="work" icon={CheckCircle2} title="Niente da fare, per ora" description="I task che ti assegnano (o che prendi in carico) compaiono qui, divisi per urgenza." className="py-8" />
        ) : (
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
            {taskGroups.map((g) => (
              <section key={g.key} className={cn("flex flex-col gap-2 rounded-xl p-2.5", g.bg)}>
                <h3 className="flex items-center gap-2 px-1 text-[12.5px] font-semibold">
                  <span className={cn("size-2.5 rounded-full", g.dot)} />
                  <span className={g.text}>{g.label}</span>
                  <span className={cn("ml-auto rounded-full px-1.5 text-[11px] font-semibold tabular", g.count)}>{g.items.length}</span>
                </h3>
                {g.items.length === 0 ? (
                  <p className="px-1 pb-1 text-xs text-muted-foreground">{g.empty}</p>
                ) : (
                  g.items.map((t) => (
                    <Link
                      key={t.id}
                      href={`/task?aperto=${t.id}`}
                      className={cn("group flex flex-col gap-2 rounded-lg border border-l-4 bg-card p-2.5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md", g.bar)}
                    >
                      <p className="flex items-start gap-1.5 text-[13px] leading-snug font-semibold">
                        <PriorityFlag priority={t.priority} />
                        <span className="line-clamp-2">{t.title}</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {t.project && (
                          <span className="flex max-w-full items-center gap-1 rounded-md bg-work/10 px-1.5 py-0.5 text-[11px] font-medium text-work-ink">
                            <Briefcase className="size-3 shrink-0" />
                            <span className="truncate">{t.project.code ? `${t.project.code}-${t.number} · ` : ""}{t.project.name}</span>
                          </span>
                        )}
                        {t.project?.client && (
                          <span className="flex max-w-full items-center gap-1 rounded-md bg-sales/20 px-1.5 py-0.5 text-[11px] font-medium text-sales-ink">
                            <Users className="size-3 shrink-0" />
                            <span className="truncate">{t.project.client.name}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge dot tone={TASK_STATUS[t.status].tone}>{TASK_STATUS[t.status].label}</Badge>
                        <span className="ml-auto">
                          <DueLabel due={t.due_date} status={t.status} />
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </section>
            ))}
          </div>
        )}
      </BandCard>

      {/* Scadenze rinnovi */}
      {d.renewals.length > 0 && (
        <BandCard area="money" icon={CalendarIcon} title="Rinnovi entro 30 giorni" href="/scadenze" linkLabel="Tutte le scadenze" bodyClassName="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {d.renewals.map((r) => {
              const days = Math.round((new Date(`${r.next_due_date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
              return (
                <Link
                  key={r.id}
                  href={`/scadenze?aperto=${r.id}`}
                  className={cn("rounded-lg border border-l-4 p-3 transition-colors hover:bg-muted/50", days < 0 ? "border-l-destructive bg-destructive/[0.03]" : "border-l-warning")}
                >
                  <p className="truncate text-[13px] font-semibold">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.client?.name ?? "Interno Omnira"}</p>
                  <p className={cn("mt-1 text-xs font-semibold", days < 0 ? "text-destructive" : "text-[oklch(0.55_0.13_75)] dark:text-warning")}>
                    {days < 0 ? `Scaduto da ${-days} g` : days === 0 ? "Scade oggi" : `Tra ${days} giorni`} · {new Date(`${r.next_due_date}T00:00:00`).toLocaleDateString("it-IT")}
                  </p>
                </Link>
              );
            })}
        </BandCard>
      )}
    </PageBody>
  );
}

/** Card della dashboard: fascia colorata dell'area con titolo bianco, bordo dello stesso colore */
function BandCard({
  area,
  icon: Icon,
  title,
  href,
  linkLabel,
  className,
  bodyClassName,
  children,
}: {
  area: Area;
  icon: typeof Users;
  title: string;
  href?: string;
  linkLabel?: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const a = AREA[area];
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card shadow-xs", a.bandBorder, className)}>
      <header className={cn("flex items-center justify-between gap-3 px-4 py-2.5 text-white", a.band)}>
        <h2 className="flex items-center gap-2 text-[14px] font-semibold">
          <Icon className="size-4.5 opacity-90" strokeWidth={2} aria-hidden />
          {title}
        </h2>
        {href && (
          <Link href={href} className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium text-white/90 transition-colors hover:bg-white/15 hover:text-white">
            {linkLabel} <ArrowRight className="size-3.5" />
          </Link>
        )}
      </header>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
