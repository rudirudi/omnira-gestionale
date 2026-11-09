import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  CheckSquare,
  UserPlus,
  TrendingUp,
  Users,
  Wallet,
  CalendarClock as CalendarIcon,
  MessageCircleQuestion,
  Plus,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageBody } from "@/components/app/page-header";
import { HeaderMenuButton, HeaderTools } from "@/components/layout/header-tools";
import { Badge } from "@/components/ui/badge";
import { AREA, type Area } from "@/lib/areas";
import type { TaskPriority, TaskStatus } from "@/lib/database.types";
import { getCurrentUser } from "@/lib/auth";
import { TASK_STATUS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { cn, formatEuro } from "@/lib/utils";
import { getDashboardData } from "@/modules/dashboard/queries";
import { dueInfo, DueLabel, PriorityFlag } from "@/modules/task/components/task-meta";
import { DiscussionRowItem } from "@/modules/discussioni/components/discussion-meta";
import { listOpenForDashboard } from "@/modules/discussioni/queries";
import { UnassignedTasks } from "@/modules/task/components/unassigned-tasks";
import { TaskTabs } from "@/modules/dashboard/components/task-tabs";
import { listActiveTeam } from "@/modules/team/queries";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(new Date().toLocaleString("it-IT", { hour: "numeric", hour12: false, timeZone: "Europe/Rome" }));
  return h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
}

/** Importo in euro senza centesimi, per i numeri grandi delle card */
const euroWhole = (cents: number) =>
  (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" } as Intl.NumberFormatOptions);

/** Blu istituzionale (quello della barra laterale) per i testi dell'intestazione */
const BRAND = "text-sidebar dark:text-[oklch(0.85_0.07_262)]";

/** Colori dell'area su icona e filo delle card numeri */
const GLASS: Record<Area, { chip: string; bar: string }> = {
  work: { chip: "bg-[oklch(0.6_0.16_255)] text-white", bar: "bg-[oklch(0.72_0.14_250)]" },
  sales: { chip: "bg-sales text-on-warning", bar: "bg-sales" },
  money: { chip: "bg-[oklch(0.6_0.15_150)] text-white", bar: "bg-[oklch(0.75_0.16_150)]" },
  support: { chip: "bg-support text-white", bar: "bg-[oklch(0.7_0.18_25)]" },
  system: { chip: "bg-muted-foreground text-white", bar: "bg-muted-foreground/40" },
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const showMoney = can.viewMoney(user.role);
  const [d, team, points] = await Promise.all([getDashboardData(user.id, showMoney), listActiveTeam(), listOpenForDashboard(user.id)]);
  const firstName = user.full_name.split(" ")[0];
  const today = new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" });
  const lateTasks = d.myTasks.filter((t) => dueInfo(t.due_date, t.status)?.late).length;
  const todayTasks = d.myTasks.filter((t) => dueInfo(t.due_date, t.status)?.diff === 0).length;

  const todayIso = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });

  const kpis: { label: string; value: string; sub: string; icon: typeof Users; href: string; area: Area }[] = [
    { label: "I miei task aperti", value: d.myTasks.length === 40 ? "40+" : String(d.myTasks.length), sub: lateTasks ? `${lateTasks} in ritardo` : "nessun ritardo", icon: CheckSquare, href: "/task?miei=1", area: "work" },
    { label: "Progetti attivi", value: String(d.activeProjects), sub: "in lavorazione", icon: Briefcase, href: "/progetti?stato=attivo", area: "work" },
    { label: "Clienti attivi", value: String(d.activeClients), sub: `${d.openLeads} lead aperti`, icon: Users, href: "/clienti?stato=attivo", area: "sales" },
    showMoney
      ? { label: "Da incassare", value: euroWhole(d.toCollectCents), sub: d.overdueCents ? `${formatEuro(d.overdueCents)} scaduti` : "nessun ritardo", icon: Wallet, href: "/incassi", area: "money" }
      : { label: "Vinti questo mese", value: euroWhole(d.wonMonthCents), sub: `${d.wonMonthCount} lead chiusi`, icon: TrendingUp, href: "/lead", area: "money" },
  ];

  // Su computer la dashboard sta tutta nello schermo: scorre solo dentro il riquadro Task
  return (
    <PageBody className="flex flex-col gap-3 pt-0 pb-4 sm:px-4 lg:h-[calc(100svh-3rem)] lg:min-h-[600px] lg:flex-none lg:overflow-hidden lg:pb-3">
      {/* Benvenuto */}
      {/* Griglia: data e saluto a sinistra uno sotto l'altro, strumenti e numeri a destra */}
      <section data-hero className={cn("grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 pt-3 pb-1 xl:grid-cols-[minmax(0,1fr)_640px]", BRAND)}>
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
          <HeaderMenuButton />
          <p className="text-[13px] font-medium opacity-70 first-letter:uppercase">{today}</p>
        </div>
        <div className="col-start-2 row-start-1 justify-self-end" data-tools>
          <HeaderTools />
        </div>
          <div className="col-span-2 row-start-2 min-w-0 self-start xl:col-span-1 xl:col-start-1">
            <h1 className="text-[22px] leading-tight font-semibold">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-0.5 text-[12.5px] opacity-85">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-warning" /> {todayTasks} task in scadenza oggi
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", lateTasks ? "bg-destructive" : "bg-success")} />
                {lateTasks ? `${lateTasks} in ritardo` : "nessun task in ritardo"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-work" /> {d.due.length} promemoria questa settimana
              </span>
            </p>
          </div>

          {/* Numeri chiave dentro l'intestazione: riquadri "in vetro", colore dell'area su icona e filo in basso */}
          <div data-kpis className="col-span-2 row-start-3 mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:col-span-1 xl:col-start-2 xl:row-span-2 xl:row-start-2">
            {kpis.map((k) => {
              const g = GLASS[k.area];
              return (
                <Link
                  key={k.label}
                  href={k.href}
                  className="group relative overflow-hidden rounded-lg bg-card px-3 pt-2 pb-2.5 shadow-xs ring-1 ring-sidebar/15 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-sidebar/35 dark:ring-white/15"
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md shadow-sm", g.chip)}>
                      <k.icon className="size-3" strokeWidth={2.2} aria-hidden />
                    </span>
                    <span className="truncate text-[11.5px] font-medium opacity-75">{k.label}</span>
                  </span>
                  <span className={cn("mt-1.5 block truncate leading-none font-semibold tracking-tight tabular", k.value.length > 9 ? "text-[18px]" : "text-[21px]")}>{k.value}</span>
                  <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="truncate">{k.sub}</span>
                    <ArrowRight className="ml-auto size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className={cn("absolute inset-x-0 bottom-0 h-[3px]", g.bar)} aria-hidden />
                </Link>
              );
            })}
          </div>
      </section>

      {/* Punti aperti: striscia compatta subito sotto l'intestazione */}
      <section aria-label="Punti aperti e discussioni" className="flex shrink-0 flex-col gap-2 rounded-xl border border-[oklch(0.62_0.145_68)] bg-warning/[0.08] p-2 md:flex-row md:items-stretch">
        <div className="flex shrink-0 items-center gap-3 px-2 md:w-44 md:flex-col md:items-start md:justify-center md:gap-0.5 md:border-r md:border-[oklch(0.62_0.145_68)]/30 md:pr-3">
          <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-sales-ink">
            <MessageCircleQuestion className="size-4" /> Punti aperti
          </span>
          <span className="text-[12px] text-sales-ink/90">
            {points.total} {points.total === 1 ? "aperto" : "aperti"}
            {points.mine > 0 && <strong className="font-semibold"> · {points.mine} tocca a te</strong>}
          </span>
          <Link href="/discussioni?stato=aperti" className="ml-auto text-[12px] font-medium text-primary hover:underline md:ml-0">
            {points.total > 3 ? `Vedi tutti (${points.total})` : "Elenco"} →
          </Link>
        </div>
        {points.items.length === 0 ? (
          <p className="flex flex-1 items-center px-2 text-[13px] text-muted-foreground">Nessun punto aperto. Aprine uno quando c&apos;è qualcosa da decidere o di cui parlare insieme.</p>
        ) : (
          <div className="grid min-w-0 flex-1 auto-cols-[minmax(260px,85%)] grid-flow-col gap-2 overflow-x-auto md:auto-cols-auto md:grid-flow-row md:grid-cols-3 md:overflow-visible">
            {points.items.slice(0, 3).map((p) => (
              <DiscussionRowItem key={p.id} d={p} meId={user.id} compact />
            ))}
          </div>
        )}
        <Link
          href="/discussioni?nuovo=1"
          aria-label="Apri un nuovo punto o una discussione"
          title="Apri un nuovo punto o una discussione"
          className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-[oklch(0.62_0.145_68)] text-[13px] font-medium text-sales-ink transition-colors hover:bg-warning/20 md:h-auto md:w-11"
        >
          <Plus className="size-5" />
          <span className="md:hidden">Apri un punto</span>
        </Link>
      </section>

      {/* Task: un solo riquadro con le schede */}
      {/* Occupa lo spazio che resta: se il contenuto è di più, si scorre dentro il riquadro */}
      <BandCard
        area="work"
        icon={CheckSquare}
        title="Task"
        href="/task"
        linkLabel="Apri la pagina Task"
        className="flex h-[80svh] min-h-[420px] flex-col lg:h-auto lg:min-h-0 lg:flex-1"
        bodyClassName="flex min-h-0 flex-1 flex-col p-2.5 sm:p-3"
      >
        <TaskTabs
          tabs={[
            {
              key: "miei",
              label: "I miei task",
              count: d.myTasks.length,
              alert: lateTasks > 0,
              content:
                d.myTasks.length === 0 ? (
                  <EmptyState area="work" icon={CheckCircle2} title="Niente da fare, per ora" description="I task che ti assegnano (o che prendi in carico) compaiono qui, divisi per urgenza." className="py-8" />
                ) : (
                  <TaskKanban tasks={d.myTasks} />
                ),
            },
            {
              key: "da-assegnare",
              label: "Da assegnare",
              count: d.unassignedCount,
              content:
                d.unassignedCount === 0 ? (
                  <EmptyState area="work" icon={UserPlus} title="Nessun task senza assegnatario" description="I task creati senza nessuno compaiono qui: tu o un collega potete prenderli in carico." className="py-8" />
                ) : (
                  <div className="flex flex-col gap-2">
                    <UnassignedTasks tasks={d.unassigned} people={team} meId={user.id} />
                    {d.unassignedCount > d.unassigned.length && (
                      <Link href="/task?chi=nessuno" className="self-end text-[12.5px] font-medium text-primary hover:underline">
                        Vedi tutti i {d.unassignedCount} task da assegnare →
                      </Link>
                    )}
                  </div>
                ),
            },
            {
              key: "rinnovi",
              label: "Rinnovi 30 gg",
              count: d.renewals.length,
              alert: d.renewals.some((r) => r.next_due_date < todayIso),
              content:
                d.renewals.length === 0 ? (
                  <EmptyState area="money" icon={CalendarIcon} title="Nessun rinnovo nei prossimi 30 giorni" description="Domini, hosting e canoni in scadenza compaiono qui." className="py-8" />
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {d.renewals.map((r) => {
                        const days = Math.round((new Date(`${r.next_due_date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
                        return (
                          <Link
                            key={r.id}
                            href={`/scadenze?aperto=${r.id}`}
                            className={cn("rounded-lg border border-l-4 bg-card p-3 transition-colors hover:bg-muted/50", days < 0 ? "border-l-destructive bg-destructive/[0.03]" : "border-l-warning")}
                          >
                            <p className="truncate text-[13px] font-semibold">{r.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{r.client?.name ?? "Interno Omnira"}</p>
                            <p className={cn("mt-1 text-xs font-semibold", days < 0 ? "text-destructive" : "text-[oklch(0.55_0.13_75)] dark:text-warning")}>
                              {days < 0 ? `Scaduto da ${-days} g` : days === 0 ? "Scade oggi" : `Tra ${days} giorni`} · {new Date(`${r.next_due_date}T00:00:00`).toLocaleDateString("it-IT")}
                            </p>
                          </Link>
                        );
                      })}
                    </div>
                    <Link href="/scadenze" className="self-end text-[12.5px] font-medium text-primary hover:underline">
                      Tutte le scadenze →
                    </Link>
                  </div>
                ),
            },
            {
              key: "team",
              label: "Tutto il team",
              count: d.teamCount,
              content:
                d.teamTasks.length === 0 ? (
                  <EmptyState area="work" icon={Users} title="Nessun task assegnato" description="Qui vedi i task aperti di tutto il team, divisi per urgenza." className="py-8" />
                ) : (
                  <TaskKanban tasks={d.teamTasks} names={new Map(team.map((m) => [m.id, m.full_name]))} meId={user.id} />
                ),
            },
          ]}
        />
      </BandCard>

    </PageBody>
  );
}

/** Card della dashboard: fascia colorata dell'area con titolo bianco, bordo dello stesso colore */
type KanbanTask = {
  id: string;
  title: string;
  number: number | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  project: { id: string; code: string | null; name: string; client: { id: string; name: string } | null } | null;
  assignees?: { user_id: string }[];
};

/** Task divisi per urgenza: colori forti dove serve agire subito */
function TaskKanban({ tasks, names, meId }: { tasks: KanbanTask[]; names?: Map<string, string>; meId?: string }) {
  const byDiff = (fn: (diff: number | null) => boolean) => tasks.filter((t) => fn(dueInfo(t.due_date, t.status)?.diff ?? null));
  const groups = [
    { key: "ritardo", label: "In ritardo", items: byDiff((x) => x !== null && x < 0), empty: "Nessun ritardo 👏", bg: "bg-destructive/[0.06]", dot: "bg-destructive", text: "text-destructive", count: "bg-destructive text-white", bar: "border-l-destructive" },
    { key: "oggi", label: "Oggi e domani", items: byDiff((x) => x === 0 || x === 1), empty: "Niente in scadenza", bg: "bg-warning/[0.12]", dot: "bg-warning", text: "text-sales-ink", count: "bg-warning text-on-warning", bar: "border-l-warning" },
    { key: "settimana", label: "Prossimi 7 giorni", items: byDiff((x) => x !== null && x >= 2 && x <= 7), empty: "Settimana libera", bg: "bg-work/[0.06]", dot: "bg-work", text: "text-work-ink", count: "bg-work text-white", bar: "border-l-work" },
    { key: "dopo", label: "Più avanti / senza data", items: byDiff((x) => x === null || x > 7), empty: "Niente in coda", bg: "bg-muted/60", dot: "bg-muted-foreground/50", text: "text-muted-foreground", count: "bg-muted-foreground/20 text-foreground", bar: "border-l-muted-foreground/30" },
  ];
  return (
    <div className="grid items-start gap-2.5 md:grid-cols-2 xl:grid-cols-4">
      {groups.map((g) => (
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
                {names && t.assignees && t.assignees.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {t.assignees.map((a) => (
                      <span key={a.user_id} className={cn("rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold", a.user_id === meId ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                        {a.user_id === meId ? "Tu" : (names.get(a.user_id)?.split(" ")[0] ?? "Ex collega")}
                      </span>
                    ))}
                  </div>
                )}
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
  );
}

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
      <header className={cn("flex items-center justify-between gap-3 px-3.5 py-2 text-white", a.band)}>
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
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </section>
  );
}
