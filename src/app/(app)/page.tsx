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
  TrendingUp,
  Users,
  Wallet,
  CalendarClock as CalendarIcon,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageBody } from "@/components/app/page-header";
import { SearchButton } from "@/components/layout/command-palette";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { Badge } from "@/components/ui/badge";
import { AREA, type Area } from "@/lib/areas";
import { getCurrentUser } from "@/lib/auth";
import { LEAD_STAGE, LEAD_STAGES, TASK_STATUS } from "@/lib/labels";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { cn, formatEuro } from "@/lib/utils";
import { getDashboardData } from "@/modules/dashboard/queries";
import { NotificationBell } from "@/modules/notifiche/components/notification-bell";
import { dueInfo, DueLabel, PriorityFlag, TaskCode } from "@/modules/task/components/task-meta";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(new Date().toLocaleString("it-IT", { hour: "numeric", hour12: false, timeZone: "Europe/Rome" }));
  return h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
}

const STAGE_BAR: Record<string, string> = {
  nuovo: "bg-muted-foreground/40",
  call: "bg-primary/60",
  analisi: "bg-primary",
  preventivo: "bg-warning",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const showMoney = can.viewMoney(user.role);
  const d = await getDashboardData(user.id, showMoney);
  const firstName = user.full_name.split(" ")[0];
  const today = new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" });
  const lateTasks = d.myTasks.filter((t) => dueInfo(t.due_date, t.status)?.late).length;
  const todayTasks = d.myTasks.filter((t) => dueInfo(t.due_date, t.status)?.diff === 0).length;
  const openStages = LEAD_STAGES.filter((s) => s.value !== "vinto" && s.value !== "perso");
  const pipelineTotal = Math.max(1, d.pipelineCents);

  const kpis: { label: string; value: string; sub: string; icon: typeof Users; href: string; area: Area }[] = [
    { label: "I miei task aperti", value: d.myTasks.length === 8 ? "8+" : String(d.myTasks.length), sub: lateTasks ? `${lateTasks} in ritardo` : "nessun ritardo", icon: CheckSquare, href: "/task", area: "work" },
    { label: "Progetti attivi", value: String(d.activeProjects), sub: "in lavorazione", icon: Briefcase, href: "/progetti?stato=attivo", area: "work" },
    { label: "Clienti attivi", value: String(d.activeClients), sub: `${d.openLeads} lead aperti`, icon: Users, href: "/clienti?stato=attivo", area: "sales" },
    showMoney
      ? { label: "Da incassare", value: formatEuro(d.toCollectCents), sub: d.overdueCents ? `${formatEuro(d.overdueCents)} scaduti` : "nessun ritardo", icon: Wallet, href: "/incassi", area: "money" }
      : { label: "Vinti questo mese", value: formatEuro(d.wonMonthCents), sub: `${d.wonMonthCount} lead chiusi`, icon: TrendingUp, href: "/lead", area: "money" },
  ];

  return (
    <PageBody className="flex flex-col gap-6">
      {/* Benvenuto */}
      <section className="relative -mx-4 -mt-6 overflow-hidden border-white/60 bg-sidebar px-5 py-5 lg:border-l text-sidebar-foreground sm:-mx-6 sm:px-7 sm:py-6">
        <div className="absolute -top-20 -right-16 size-72 rounded-full bg-white/[0.06]" aria-hidden />
        <div className="absolute -bottom-24 right-40 size-56 rounded-full bg-white/[0.04]" aria-hidden />
        <div className="relative mb-4 flex items-center gap-2 sm:mb-1">
          <MobileNav hidden={showMoney ? [] : ["/incassi", "/preventivi"]} onDark />
          <p className="text-[13px] font-medium text-sidebar-muted first-letter:uppercase">{today}</p>
          <div className="ml-auto flex items-center gap-1.5">
            <SearchButton onDark className="hidden w-64 md:flex" />
            <SearchButton onDark className="w-9 justify-center px-0 md:hidden [&>span]:hidden" />
            <NotificationBell userId={user.id} onDark />
            <UserMenu name={user.full_name} email={user.email} roleLabel={ROLE_LABEL[user.role]} onDark />
          </div>
        </div>
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
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

          {/* Numeri chiave, colorati per area: compatti dentro l'intestazione */}
          <div className="grid shrink-0 grid-cols-2 gap-2.5 md:grid-cols-4 xl:w-[680px]">
            {kpis.map((k) => {
              const a = AREA[k.area];
              return (
                <Link key={k.label} href={k.href} className={cn("group overflow-hidden rounded-lg border bg-card text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md", a.bandBorder)}>
                  <div className={cn("flex items-center justify-between gap-2 px-3 py-1.5 text-white", a.band)}>
                    <p className="truncate text-[12px] font-semibold">{k.label}</p>
                    <k.icon className="size-3.5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                  </div>
                  <div className="px-3 pt-2 pb-2">
                    <p className="truncate text-[22px] leading-tight font-semibold tracking-tight tabular">{k.value}</p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <span className="truncate">{k.sub}</span>
                      <ArrowRight className="ml-auto size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        {/* I miei task */}
        <BandCard area="work" icon={CheckSquare} title="I miei task" href="/task" linkLabel="Tutti i task" className="xl:col-span-3">
            {d.myTasks.length === 0 ? (
              <EmptyState area="work" icon={CheckCircle2} title="Niente da fare, per ora" description="I task che ti assegnano compaiono qui, ordinati per scadenza." className="py-8" />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {d.myTasks.map((t) => {
                  const info = dueInfo(t.due_date, t.status);
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/task?aperto=${t.id}`}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border border-l-4 px-3 py-2.5 transition-colors hover:bg-muted/50",
                          info?.late ? "border-l-destructive bg-destructive/[0.03]" : info?.soon ? "border-l-warning" : "border-l-work/40",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{t.title}</p>
                          <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
                            <TaskCode code={t.project?.code} number={t.number} /> {t.project?.name}
                          </p>
                        </div>
                        <PriorityFlag priority={t.priority} />
                        <Badge dot tone={TASK_STATUS[t.status].tone} className="hidden sm:inline-flex">
                          {TASK_STATUS[t.status].label}
                        </Badge>
                        <span className="w-16 text-right">
                          <DueLabel due={t.due_date} status={t.status} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
        </BandCard>

        {/* Promemoria */}
        <BandCard area="support" icon={Bell} title="Promemoria della settimana" className="xl:col-span-2">
            {d.due.length === 0 ? (
              <EmptyState area="support" icon={Bell} title="Niente in scadenza" description="Aggiungi un promemoria da un cliente o da un lead." className="py-8" />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {d.due.map((a) => {
                  const late = new Date(a.due_at!) < new Date();
                  const href = a.client ? `/clienti/${a.client.id}?scheda=attivita` : `/lead?aperto=${a.lead_id}`;
                  return (
                    <li key={a.id}>
                      <Link href={href} className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/60">
                        <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", late ? "bg-destructive/10 text-destructive" : "bg-warning/25 text-on-warning dark:text-warning")}>
                          {late ? <AlertTriangle className="size-4" /> : <CalendarClock className="size-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">{a.subject}</p>
                          <p className={cn("text-xs", late ? "font-medium text-destructive" : "text-muted-foreground")}>
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
        </BandCard>
      </div>

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

      {/* Pipeline commerciale */}
      <BandCard area="sales" icon={Target} title={`Pipeline commerciale · ${formatEuro(d.pipelineCents)}`} href="/lead" linkLabel="Apri la pipeline" bodyClassName="flex flex-col gap-5">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="Valore dei lead aperti per fase">
            {openStages.map((s) => {
              const v = d.pipelineByStage[s.value]?.value ?? 0;
              return v ? <div key={s.value} className={STAGE_BAR[s.value]} style={{ width: `${(v / pipelineTotal) * 100}%` }} title={`${s.label}: ${formatEuro(v)}`} /> : null;
            })}
          </div>
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
      </BandCard>
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
