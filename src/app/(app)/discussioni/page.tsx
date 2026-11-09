import { MessageCircleQuestion } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/auth";
import { DiscussionFilters, NewDiscussionDialog } from "@/modules/discussioni/components/discussion-controls";
import { DiscussionRowItem } from "@/modules/discussioni/components/discussion-meta";
import { listDiscussions, listProjectOptions } from "@/modules/discussioni/queries";
import { listClientOptions } from "@/modules/progetti/queries";
import { listActiveTeam } from "@/modules/team/queries";

export const metadata = { title: "Punti aperti" };

export default async function DiscussioniPage({ searchParams }: PageProps<"/discussioni">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const status = sp.stato === "aperti" ? "aperto" : sp.stato === "risolti" ? "risolto" : undefined;
  const kind = sp.tipo === "punto" || sp.tipo === "discussione" ? sp.tipo : undefined;
  const [items, team, projects, clients] = await Promise.all([
    listDiscussions({ status, kind, mineId: sp.miei === "1" ? user.id : undefined }),
    listActiveTeam(),
    listProjectOptions(),
    listClientOptions(),
  ]);
  const open = items.filter((d) => d.status === "aperto").length;

  return (
    <>
      <PageHeader
        title="Punti aperti e discussioni"
        area="work"
        icon={MessageCircleQuestion}
        description={`${open} aperti · ${items.length - open} risolti`}
        actions={<NewDiscussionDialog team={team} projects={projects} clients={clients} />}
      >
        <DiscussionFilters />
      </PageHeader>
      <PageBody>
        {items.length === 0 ? (
          <EmptyState
            area="work"
            icon={MessageCircleQuestion}
            title="Nessun punto aperto"
            description="Apri un punto quando c'è qualcosa da decidere o risolvere insieme: il team risponde sotto e alla fine lo segnate come risolto."
          />
        ) : (
          <div className="grid gap-2 xl:grid-cols-2">
            {items.map((d) => (
              <DiscussionRowItem key={d.id} d={d} meId={user.id} />
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
