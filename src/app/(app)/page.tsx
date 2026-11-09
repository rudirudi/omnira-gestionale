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
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageBody } from "@/components/app/page-header";
import { HeaderMenuButton, HeaderTools } from "@/components/layout/header-tools";
import { Badge } from "@/components/ui/badge";
import { AREA, type Area } from "@/lib/areas";
import { getCurrentUser } from "@/lib/auth";
import { TASK_STATUS } from "@/lib/labels";
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
  const [d, team] = await Promise.all([getDashboardData(user.id, showMoney), listActiveTeam()]);
  const firstName = user.full_name.split(" ")[0];
  const today = new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" });
  const lateTasks = d.myTasks.filter((t) => dueInfo(t.due_date, t.status)?.late).length;
  const todayTasks = d.myTasks.filter((t) => dueInfo(t.due_date, t.status)?.diff === 0).length;

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
    <PageBody className="flex flex-col gap-3 pt-0 pb-4 sm:px-4">
      {/* Benvenuto */}
      {/* Griglia: data e saluto a sinistra uno sotto l'altro, strumenti e numeri a destra */}
      <section data-hero className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 pt-3 pb-1 xl:grid-cols-[minmax(0,1fr)_640px]", BRAND)}>
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

      {/* I miei task, divisi per urgenza */}
      <BandCard area="work" icon={CheckSquare} title={`I miei task · ${d.myTasks.length} aperti`} href="/task?miei=1" linkLabel="Tutti i miei task" bodyClassName="p-2.5 sm:p-3">
        {d.myTasks.length === 0 ? (
          <EmptyState area="work" icon={CheckCircle2} title="Niente da fare, per ora" description="I task che ti assegnano (o che prendi in carico) compaiono qui, divisi per urgenza." className="py-8" />
        ) : (
          <div className="grid items-start gap-2.5 md:grid-cols-2 xl:grid-cols-4">
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
