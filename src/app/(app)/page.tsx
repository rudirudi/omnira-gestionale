import Link from "next/link";
import { ArrowRight, Bell, Briefcase, CalendarClock, CheckCircle2, Target, TrendingUp, Users } from "lucide-react";
import { DueLabel, PriorityFlag, TaskCode } from "@/modules/task/components/task-meta";
import { TASK_STATUS } from "@/lib/labels";
import { EmptyState } from "@/components/app/empty-state";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { LEAD_STAGE } from "@/lib/labels";
import { cn, formatEuro } from "@/lib/utils";
import { getDashboardData } from "@/modules/dashboard/queries";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(new Date().toLocaleString("it-IT", { hour: "numeric", hour12: false, timeZone: "Europe/Rome" }));
  return h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const d = await getDashboardData(user.id);
  const firstName = user.full_name.split(" ")[0];
  const today = new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" });

  const kpis = [
    { label: "I miei task aperti", value: String(d.myTasks.length === 8 ? "8+" : d.myTasks.length), icon: CheckCircle2, href: "/task", tone: "bg-primary/10 text-primary" },
    { label: "Progetti attivi", value: String(d.activeProjects), icon: Briefcase, href: "/progetti?stato=attivo", tone: "bg-success/14 text-success" },
    { label: "Clienti attivi", value: String(d.activeClients), icon: Users, href: "/clienti?stato=attivo", tone: "bg-warning text-warning-foreground dark:bg-warning/20" },
    {
      label: "Pipeline commerciale",
      value: formatEuro(d.pipelineCents),
      sub: `${d.openLeads} lead aperti · ${formatEuro(d.wonMonthCents)} vinti nel mese`,
      icon: TrendingUp,
      href: "/lead",
      tone: "bg-destructive/10 text-destructive",
    },
  ];

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName}`} description={today.charAt(0).toUpperCase() + today.slice(1)} />
      <PageBody className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <Link key={k.label} href={k.href} className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/40">
              <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                {k.label}
                <span className={cn("flex size-8 items-center justify-center rounded-md", k.tone)}>
                  <k.icon className="size-4" strokeWidth={2} />
                </span>
              </div>
              <p className="mt-2 text-[26px] leading-none font-semibold tracking-tight tabular">{k.value}</p>
              {k.sub && <p className="mt-1.5 text-xs text-muted-foreground">{k.sub}</p>}
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>I miei task</CardTitle>
            <Link href="/task" className="flex items-center gap-1 text-[13px] text-primary hover:underline">
              Tutti i task <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="pt-3">
            {d.myTasks.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Niente da fare, per ora" description="I task che ti assegnano compaiono qui, ordinati per scadenza." className="py-8" />
            ) : (
              <ul className="divide-y">
                {d.myTasks.map((t) => (
                  <li key={t.id}>
                    <Link href={`/task?aperto=${t.id}`} className="flex items-center gap-3 py-2.5 hover:text-primary">
                      <TaskCode code={t.project?.code} number={t.number} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{t.title}</span>
                      <span className="hidden truncate text-xs text-muted-foreground md:inline">{t.project?.name}</span>
                      <PriorityFlag priority={t.priority} />
                      <Badge tone={TASK_STATUS[t.status].tone}>{TASK_STATUS[t.status].label}</Badge>
                      <span className="w-16 text-right">
                        <DueLabel due={t.due_date} status={t.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Ultimi lead</CardTitle>
              <Link href="/lead" className="flex items-center gap-1 text-[13px] text-primary hover:underline">
                Pipeline <ArrowRight className="size-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="pt-3">
              {d.recentLeads.length === 0 ? (
                <EmptyState icon={Target} title="Nessun lead" description="I nuovi contatti commerciali compariranno qui." className="py-8" />
              ) : (
                <ul className="divide-y">
                  {d.recentLeads.map((l) => (
                    <li key={l.id}>
                      <Link href={`/lead?aperto=${l.id}`} className="flex items-center gap-3 py-2.5 hover:text-primary">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{l.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{l.company_name ?? "—"}</p>
                        </div>
                        <span className="text-[13px] tabular">{formatEuro(l.estimated_value_cents)}</span>
                        <Badge tone={LEAD_STAGE[l.stage].tone}>{LEAD_STAGE[l.stage].label}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Scadenze dei prossimi 7 giorni</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {d.due.length === 0 ? (
                <EmptyState icon={Bell} title="Niente in scadenza" description="Aggiungi un promemoria da un cliente o da un lead." className="py-8" />
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {d.due.map((a) => {
                    const late = new Date(a.due_at!) < new Date();
                    const href = a.client ? `/clienti/${a.client.id}?scheda=attivita` : `/lead?aperto=${a.lead_id}`;
                    return (
                      <li key={a.id}>
                        <Link href={href} className="flex items-start gap-2.5 rounded-md p-1.5 hover:bg-muted">
                          <CalendarClock className={cn("mt-0.5 size-4 shrink-0", late ? "text-destructive" : "text-muted-foreground")} />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{a.subject}</p>
                            <p className={cn("text-xs", late ? "text-destructive" : "text-muted-foreground")}>
                              {late ? "Scaduta · " : ""}
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
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
