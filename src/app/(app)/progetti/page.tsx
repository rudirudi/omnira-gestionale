import Link from "next/link";
import { Briefcase, CalendarDays } from "lucide-react";
import { AvatarStack } from "@/components/app/avatar-stack";
import { EmptyState } from "@/components/app/empty-state";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ProgressBar } from "@/components/app/progress-bar";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import type { ProjectStatus } from "@/lib/database.types";
import { PROJECT_STATUS, PROJECT_TYPE } from "@/lib/labels";
import { TONE } from "@/lib/areas";
import { can } from "@/lib/permissions";
import { cn, formatDate } from "@/lib/utils";
import { type ProjectListItem } from "@/modules/progetti/queries";
import { NewProjectDialog } from "@/modules/progetti/components/new-project-dialog";
import { ProjectFilters } from "@/modules/progetti/components/project-filters";
import { listClientOptions, listProjects } from "@/modules/progetti/queries";
import { listActiveTeam } from "@/modules/team/queries";

export const metadata = { title: "Progetti" };

export default async function ProgettiPage({ searchParams }: PageProps<"/progetti">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const statoParam = typeof sp.stato === "string" ? sp.stato : "";
  const status: ProjectStatus | "aperti" | undefined =
    statoParam === "aperti" ? "aperti" : statoParam in PROJECT_STATUS ? (statoParam as ProjectStatus) : undefined;
  const [projects, clients, team] = await Promise.all([
    listProjects({ status, mine: sp.miei === "1", userId: user.id }),
    listClientOptions(),
    listActiveTeam(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const ordine = typeof sp.ordine === "string" && sp.ordine in ORDER ? (sp.ordine as Order) : "stato";
  const sorted = sortProjects(projects, ordine);
  // Nell'ordine predefinito i progetti chiusi finiscono in fondo, in una sezione separata
  const sections =
    ordine === "stato"
      ? [
          { key: "aperti", title: "Da completare", items: sorted.filter((p) => !CLOSED.has(p.status)) },
          { key: "chiusi", title: "Completati e annullati", items: sorted.filter((p) => CLOSED.has(p.status)) },
        ].filter((x) => x.items.length)
      : [{ key: "tutti", title: "", items: sorted }];
  const teamName = new Map(team.map((t) => [t.id, t.full_name]));

  return (
    <>
      <PageHeader
        title="Progetti"
        area="work"
        icon={Briefcase}
        description={`${projects.length} ${projects.length === 1 ? "progetto" : "progetti"}`}
        actions={can.manageProjects(user.role) && <NewProjectDialog clients={clients} team={team} />}
      >
        <ProjectFilters />
      </PageHeader>
      <PageBody>
        {projects.length === 0 ? (
          <EmptyState area="work" icon={Briefcase} title="Nessun progetto" description="Crea un progetto: fasi e task tipici vengono preparati in automatico." />
        ) : (
          <div className="flex flex-col gap-6">
            {sections.map((sec) => (
              <section key={sec.key} aria-label={sec.title || undefined} className="flex flex-col gap-3">
                {sec.title && sections.length > 1 && (
                  <h2 className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
                    {sec.title} <span className="rounded-full bg-muted px-2 text-[11.5px] tabular">{sec.items.length}</span>
                    <span className="h-px flex-1 bg-border" />
                  </h2>
                )}
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {sec.items.map((p) => {
              const total = p.progress?.total_tasks ?? 0;
              const done = p.progress?.done_tasks ?? 0;
              const overdue = p.progress?.overdue_tasks ?? 0;
              const allDone = total > 0 && done === total && !CLOSED.has(p.status);
              const late = p.due_date && p.due_date < today && !CLOSED.has(p.status) && !allDone;
              return (
                <Link key={p.id} href={`/progetti/${p.id}`} className={cn("group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 pt-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md")}>
                  <span className={cn("absolute inset-x-0 top-0 h-1", TONE[PROJECT_STATUS[p.status].tone].dot)} aria-hidden />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold tracking-wide text-work-ink uppercase"><span className="font-mono">{p.code}</span> · {PROJECT_TYPE[p.type]}</p>
                      <p className="mt-1 truncate text-[15px] font-semibold group-hover:text-primary">{p.name}</p>
                      <p className="truncate text-[13px] text-muted-foreground">{p.client?.name ?? "Progetto interno"}</p>
                    </div>
                    <Badge dot tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Badge>
                  </div>
                  <ProgressBar value={total ? (done / total) * 100 : 0} label={`Avanzamento ${p.name}`} late={overdue > 0 || !!late} />
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="tabular">{done}/{total} task</span>
                    {overdue > 0 && <span className="font-medium text-destructive">{overdue} in ritardo</span>}
                    {allDone && <span className="rounded-full bg-success/12 px-2 py-0.5 font-semibold text-success">Da chiudere</span>}
                    {p.due_date && (
                      <span className={cn("flex items-center gap-1", late && "font-medium text-destructive")}>
                        <CalendarDays className="size-3.5" /> {formatDate(p.due_date)}
                      </span>
                    )}
                    <AvatarStack className="ml-auto" names={p.members.flatMap((m) => teamName.get(m.user_id) ?? [])} />
                  </div>
                </Link>
              );
            })}
          </div>
              </section>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}

const CLOSED = new Set(["completato", "annullato"]);
const ORDER = { stato: 1, scadenza: 1, avanzamento: 1, recenti: 1, nome: 1 };
type Order = keyof typeof ORDER;
const RANK: Record<string, number> = { attivo: 0, pianificato: 1, in_pausa: 2, completato: 3, annullato: 4 };

function sortProjects(list: ProjectListItem[], order: Order) {
  const due = (p: ProjectListItem) => p.due_date ?? "9999-12-31";
  const pct = (p: ProjectListItem) => (p.progress?.total_tasks ? (p.progress.done_tasks ?? 0) / p.progress.total_tasks : 0);
  const byName = (a: ProjectListItem, b: ProjectListItem) => a.name.localeCompare(b.name, "it");
  return [...list].sort((a, b) => {
    switch (order) {
      case "scadenza":
        return due(a).localeCompare(due(b)) || byName(a, b);
      case "avanzamento":
        return pct(b) - pct(a) || byName(a, b);
      case "recenti":
        return b.updated_at.localeCompare(a.updated_at);
      case "nome":
        return byName(a, b);
      default: {
        // tra gli aperti, quelli con tutti i task chiusi vanno in coda (sono quasi finiti)
        const fin = (p: ProjectListItem) => (!CLOSED.has(p.status) && p.progress?.total_tasks && p.progress.done_tasks === p.progress.total_tasks ? 1 : 0);
        if (!CLOSED.has(a.status) && !CLOSED.has(b.status) && fin(a) !== fin(b)) return fin(a) - fin(b);
        const r = (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9);
        if (r) return r;
        // aperti: prima la scadenza più vicina; chiusi: prima i più recenti
        if (CLOSED.has(a.status)) return (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at);
        return due(a).localeCompare(due(b)) || byName(a, b);
      }
    }
  });
}
