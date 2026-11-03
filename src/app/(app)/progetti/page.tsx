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
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {projects.map((p) => {
              const total = p.progress?.total_tasks ?? 0;
              const done = p.progress?.done_tasks ?? 0;
              const overdue = p.progress?.overdue_tasks ?? 0;
              const late = p.due_date && p.due_date < today && p.status !== "completato";
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
        )}
      </PageBody>
    </>
  );
}
