import { PageBody, PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listProjects } from "@/modules/progetti/queries";
import { TaskWorkspace } from "@/modules/task/components/task-workspace";
import { listTasks } from "@/modules/task/queries";
import { listActiveTeam } from "@/modules/team/queries";
import { TaskScopeToggle } from "./scope-toggle";

export const metadata = { title: "Task" };

export default async function TaskPage({ searchParams }: PageProps<"/task">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const all = sp.tutti === "1";
  const [tasks, team, projects] = await Promise.all([
    listTasks({ userId: user.id, mine: !all }),
    listActiveTeam(),
    listProjects({ status: "aperti", userId: user.id }),
  ]);
  const open = tasks.filter((t) => t.status !== "fatto").length;

  return (
    <>
      <PageHeader
        title={all ? "Task del team" : "I miei task"}
        description={`${open} aperti`}
        actions={<TaskScopeToggle all={all} />}
      />
      <PageBody>
        <TaskWorkspace
          tasks={tasks}
          team={team}
          me={user.id}
          basePath="/task"
          projects={projects.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
          defaultView="lista"
          canDelete={can.deleteTasks(user.role)}
          isAdmin={user.role === "admin"}
          showProject
        />
      </PageBody>
    </>
  );
}
