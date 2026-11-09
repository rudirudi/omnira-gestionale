import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Building2, CalendarDays, ChevronLeft, Clock, Euro, UserRound } from "lucide-react";
import { getProjectTech } from "@/modules/tecnica/queries";
import { TechSheet } from "@/modules/tecnica/components/tech-sheet";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ProgressBar } from "@/components/app/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth";
import { BILLING_TYPE, PROJECT_STATUS, PROJECT_TYPE } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { formatDate, formatEuro } from "@/lib/utils";
import { CommentThread } from "@/modules/commenti/components/comment-thread";
import { updateProjectAction } from "@/modules/progetti/actions";
import { MembersPanel, MilestonesPanel, PhasesPanel } from "@/modules/progetti/components/plan-panels";
import { ProjectForm } from "@/modules/progetti/components/project-form";
import { getProject, listClientOptions } from "@/modules/progetti/queries";
import { TaskWorkspace } from "@/modules/task/components/task-workspace";
import { listProjectTasks } from "@/modules/task/queries";
import { listActiveTeam } from "@/modules/team/queries";
import { ReceivablesView } from "@/modules/incassi/components/receivables-view";
import { listProjectOptions, listReceivables } from "@/modules/incassi/queries";
import { ProjectCosts } from "@/modules/spese/components/project-costs";
import { listExpenses } from "@/modules/spese/queries";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: PageProps<"/progetti/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Progetto" };
  const p = await getProject(id);
  return { title: p ? `${p.code} ${p.name}` : "Progetto" };
}

export default async function ProgettoPage({ params, searchParams }: PageProps<"/progetti/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const [user, project] = await Promise.all([getCurrentUser(), getProject(id)]);
  if (!project) notFound();
  const showMoney = can.viewMoney(user.role);
  const [tasks, team, clients, receivables, projectOptions, costs, techData] = await Promise.all([
    listProjectTasks(id),
    listActiveTeam(),
    listClientOptions(),
    showMoney ? listReceivables({ projectId: id }) : Promise.resolve([]),
    showMoney ? listProjectOptions() : Promise.resolve([]),
    showMoney ? listExpenses({ projectId: id }) : Promise.resolve([]),
    getProjectTech(id),
  ]);
  const canManage = can.manageProjects(user.role);
  const tab = typeof sp.scheda === "string" ? sp.scheda : "task";
  const total = project.progress?.total_tasks ?? 0;
  const done = project.progress?.done_tasks ?? 0;
  const counts: Record<string, { total: number; done: number }> = {};
  for (const t of tasks) {
    if (!t.phase_id) continue;
    const c = (counts[t.phase_id] ??= { total: 0, done: 0 });
    c.total++;
    if (t.status === "fatto") c.done++;
  }
  const update = updateProjectAction.bind(null, id);
  // Clienti inattivi già collegati restano selezionabili nel form
  const clientOptions = project.client && !clients.some((c) => c.id === project.client!.id) ? [project.client, ...clients] : clients;

  return (
    <>
      <PageHeader
        area="work"
        icon={Briefcase}
        eyebrow={`Progetto · ${project.code}`}
        title={
          <span className="flex items-center gap-3">
            {project.name}
            <Badge dot tone={PROJECT_STATUS[project.status].tone}>{PROJECT_STATUS[project.status].label}</Badge>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{PROJECT_TYPE[project.type]}</span>
            {project.client ? (
              <Link href={`/clienti/${project.client.id}`} className="flex items-center gap-1 hover:text-foreground">
                <Building2 className="size-3.5" /> {project.client.name}
              </Link>
            ) : (
              <span>Progetto interno</span>
            )}
            {project.manager && (
              <span className="flex items-center gap-1">
                <UserRound className="size-3.5" /> PM {project.manager.full_name}
              </span>
            )}
            {(project.start_date || project.due_date) && (
              <span className="flex items-center gap-1 tabular">
                <CalendarDays className="size-3.5" /> {formatDate(project.start_date)} → {formatDate(project.due_date)}
              </span>
            )}
            {project.budget_cents != null && (
              <span className="flex items-center gap-1">
                <Euro className="size-3.5" /> {formatEuro(project.budget_cents)} · {BILLING_TYPE[project.billing_type].toLowerCase()}
              </span>
            )}
            {project.budget_hours != null && (
              <span className="flex items-center gap-1 tabular">
                <Clock className="size-3.5" /> {Number(project.progress?.estimated_hours ?? 0)} h stimate / {project.budget_hours} h previste
              </span>
            )}
          </span>
        }
        actions={
          <Link href="/progetti" className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Progetti
          </Link>
        }
      >
        <ProgressBar value={total ? (done / total) * 100 : 0} className="max-w-md" label="Avanzamento progetto" late={(project.progress?.overdue_tasks ?? 0) > 0} />
      </PageHeader>
      <PageBody>
        <Tabs defaultValue={tab}>
          <TabsList>
            <TabsTrigger value="task">Task ({total})</TabsTrigger>
            <TabsTrigger value="piano">Fasi e milestone</TabsTrigger>
            {showMoney && <TabsTrigger value="pagamenti">Pagamenti e costi</TabsTrigger>}
            <TabsTrigger value="team">Team ({project.members.length})</TabsTrigger>
            <TabsTrigger value="tecnica">Scheda tecnica{techData.services.length ? ` (${techData.services.length})` : ""}</TabsTrigger>
            <TabsTrigger value="discussione">Discussione</TabsTrigger>
            <TabsTrigger value="dettagli">Dettagli</TabsTrigger>
          </TabsList>
          <TabsContent value="task">
            <TaskWorkspace
              tasks={tasks}
              team={team}
              me={user.id}
              basePath={`/progetti/${id}`}
              projectId={id}
              phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
              canDelete={can.deleteTasks(user.role)}
              isAdmin={user.role === "admin"}
            />
          </TabsContent>
          <TabsContent value="piano" className="grid gap-8 lg:grid-cols-[3fr_2fr]">
            <section>
              <h2 className="mb-3 text-[15px] font-semibold">Fasi</h2>
              <PhasesPanel projectId={id} phases={project.phases} counts={counts} canEdit={canManage} />
            </section>
            <section>
              <h2 className="mb-3 text-[15px] font-semibold">Milestone</h2>
              <MilestonesPanel projectId={id} milestones={project.milestones} canEdit={canManage} />
            </section>
          </TabsContent>
          {showMoney && (
            <TabsContent value="pagamenti" className="flex max-w-4xl flex-col gap-8">
              <div>
              {!project.client_id ? (
                <p className="text-[13px] text-muted-foreground">Progetto interno: collega un cliente (scheda Dettagli) per gestire i pagamenti.</p>
              ) : (
                <ReceivablesView
                  items={receivables}
                  clients={clientOptions}
                  projects={projectOptions}
                  canManage={can.manageMoney(user.role)}
                  canDelete={user.role === "admin"}
                  showClient={false}
                  showProject={false}
                  showFilters={false}
                  compact
                  newDefaults={{
                    client_id: project.client_id,
                    project_id: id,
                    description: receivables.length ? "" : project.name,
                    amount_cents: receivables.length ? undefined : (project.budget_cents ?? undefined),
                  }}
                />
              )}
              </div>
              <ProjectCosts
                projectId={id}
                items={costs}
                paidCents={receivables.reduce((s, r) => s + r.paid, 0)}
                people={team}
                projects={projectOptions}
                meId={user.id}
                canManage={can.manageMoney(user.role)}
                isAdmin={user.role === "admin"}
              />
            </TabsContent>
          )}
          <TabsContent value="team" className="max-w-3xl">
            <MembersPanel projectId={id} members={project.members} team={team} managerId={project.manager_id} canEdit={canManage} />
          </TabsContent>
          <TabsContent value="tecnica">
            <TechSheet projectId={id} data={techData} />
          </TabsContent>
          <TabsContent value="discussione" className="max-w-2xl">
            <CommentThread entityType="project" entityId={id} team={team} meId={user.id} isAdmin={user.role === "admin"} />
          </TabsContent>
          <TabsContent value="dettagli" className="max-w-3xl">
            <ProjectForm action={update} defaults={project} clients={clientOptions} team={team} submitLabel="Salva modifiche" readOnly={!canManage} />
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}
