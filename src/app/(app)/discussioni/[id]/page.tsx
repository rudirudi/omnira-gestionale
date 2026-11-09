import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, CalendarDays, CheckCircle2, Flag, UserRound, Users } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";
import { CommentThread } from "@/modules/commenti/components/comment-thread";
import { DeleteDiscussionButton, EditDiscussionDialog, StatusControl } from "@/modules/discussioni/components/discussion-controls";
import { dueState, KIND, KindIcon, PRIORITY, StatusBadge } from "@/modules/discussioni/components/discussion-meta";
import { getDiscussion, listProjectOptions } from "@/modules/discussioni/queries";
import { listClientOptions } from "@/modules/progetti/queries";
import { listActiveTeam } from "@/modules/team/queries";

export async function generateMetadata({ params }: PageProps<"/discussioni/[id]">) {
  const { id } = await params;
  const d = await getDiscussion(id);
  return { title: d ? `#${d.number} ${d.title}` : "Punto aperto" };
}

export default async function DiscussionePage({ params }: PageProps<"/discussioni/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getCurrentUser();
  const [d, team, projects, clients] = await Promise.all([getDiscussion(id), listActiveTeam(), listProjectOptions(), listClientOptions()]);
  if (!d) notFound();
  const resolved = d.status === "risolto";
  const due = dueState(d.due_date, d.status);
  const canDelete = d.created_by === user.id || user.role === "admin";

  return (
    <>
      <PageHeader
        title={d.title}
        area="work"
        eyebrow={
          <span className="flex items-center gap-2">
            <Link href="/discussioni" className="flex items-center gap-1 hover:underline">
              <ArrowLeft className="size-3" /> Punti aperti
            </Link>
            <span className="text-muted-foreground">· #{d.number} · {KIND[d.kind].label}</span>
          </span>
        }
        actions={
          <>
            {canDelete && <DeleteDiscussionButton id={d.id} />}
            <EditDiscussionDialog discussion={d} team={team} projects={projects} clients={clients} />
          </>
        }
      />
      <PageBody className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className={cn("rounded-xl border border-l-4 bg-card p-4 shadow-xs sm:p-5", resolved ? "border-l-success" : d.priority === "alta" ? "border-l-destructive" : KIND[d.kind].bar)}>
            <div className="flex items-center gap-3">
              <KindIcon kind={d.kind} resolved={resolved} />
              <div className="min-w-0 text-[12.5px] text-muted-foreground">
                Aperto da <span className="font-medium text-foreground">{d.author?.full_name ?? "—"}</span> il {formatDate(d.created_at)}
              </div>
              <span className="ml-auto">
                <StatusBadge status={d.status} />
              </span>
            </div>
            {d.body ? (
              <p className="mt-4 text-[14px] leading-relaxed whitespace-pre-wrap">{d.body}</p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground italic">Nessuna descrizione.</p>
            )}
            {resolved && (
              <div className="mt-4 rounded-lg border border-success/30 bg-success/8 p-3">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-money-ink">
                  <CheckCircle2 className="size-4" /> Risolto da {d.resolver?.full_name ?? "—"}
                  {d.resolved_at && <span className="font-normal text-muted-foreground"> · {formatDate(d.resolved_at)}</span>}
                </p>
                {d.resolution && <p className="mt-1.5 text-[13.5px] whitespace-pre-wrap">{d.resolution}</p>}
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
            <h2 className="mb-3 text-[15px] font-semibold">
              Risposte <span className="text-muted-foreground">· {d.replies_count}</span>
            </h2>
            <CommentThread entityType="discussion" entityId={d.id} team={team} meId={user.id} isAdmin={user.role === "admin"} />
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <section className="rounded-xl border bg-card p-4 shadow-xs">
            <h2 className="mb-3 text-[13px] font-semibold">{resolved ? "Risolto" : "Chiudi il punto"}</h2>
            <StatusControl id={d.id} status={d.status} resolution={d.resolution} />
          </section>
          <section className="rounded-xl border bg-card p-4 text-[13px] shadow-xs">
            <dl className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <dt className="flex w-28 items-center gap-1.5 text-muted-foreground"><UserRound className="size-3.5" /> Responsabile</dt>
                <dd className={cn("font-medium", d.owner_id === user.id && "text-primary")}>{d.owner ? (d.owner_id === user.id ? "Tu" : d.owner.full_name) : "Nessuno"}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="flex w-28 items-center gap-1.5 text-muted-foreground"><Flag className="size-3.5" /> Priorità</dt>
                <dd className={cn("font-medium", d.priority === "alta" && "text-destructive")}>{PRIORITY[d.priority]}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="flex w-28 items-center gap-1.5 text-muted-foreground"><CalendarDays className="size-3.5" /> Entro il</dt>
                <dd className={cn("font-medium", due?.late && "text-destructive")}>{d.due_date ? `${formatDate(d.due_date)}${due?.late ? " · scaduto" : ""}` : "—"}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="flex w-28 shrink-0 items-center gap-1.5 text-muted-foreground"><Briefcase className="size-3.5" /> Progetto</dt>
                <dd className="min-w-0 truncate font-medium">
                  {d.project ? <Link href={`/progetti/${d.project.id}`} className="text-primary hover:underline">{d.project.name}</Link> : "—"}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="flex w-28 shrink-0 items-center gap-1.5 text-muted-foreground"><Users className="size-3.5" /> Cliente</dt>
                <dd className="min-w-0 truncate font-medium">
                  {d.client ? <Link href={`/clienti/${d.client.id}`} className="text-primary hover:underline">{d.client.name}</Link> : "—"}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </PageBody>
    </>
  );
}
