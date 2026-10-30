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
    statoParam === "tutti" ? undefined : statoParam in PROJECT_STATUS ? (statoParam as ProjectStatus) : "aperti";
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
        description={`${projects.length} ${projects.length === 1 ? "progetto" : "progetti"}`}
        actions={can.manageProjects(user.role) && <NewProjectDialog clients={clients} team={team} />}
      >
        <ProjectFilters />
      </PageHeader>
      <PageBody>
        {projects.length === 0 ? (
          <EmptyState icon={Briefcase} title="Nessun progetto" description="Crea un progetto: fasi e task tipici vengono preparati in automatico." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {projects.map((p) => {
              const total = p.progress?.total_tasks ?? 0;
              const done = p.progress?.done_tasks ?? 0;
              const overdue = p.progress?.overdue_tasks ?? 0;
              const late = p.due_date && p.due_date < today && p.status !== "completato";
              return (
                <Link key={p.id} href={`/progetti/${p.id}`} className="group flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-muted-foreground">{p.code} · {PROJECT_TYPE[p.type]}</p>
                      <p className="mt-0.5 truncate font-medium group-hover:text-primary">{p.name}</p>
                      <p className="truncate text-[13px] text-muted-foreground">{p.client?.name ?? "Progetto interno"}</p>
                    </div>
                    <Badge tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Badge>
                  </div>
                  <ProgressBar value={total ? (done / total) * 100 : 0} label={`Avanzamento ${p.name}`} />
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
