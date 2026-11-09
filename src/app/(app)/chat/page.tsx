import { MessagesSquare } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/auth";
import { chatMessagesAction, chatOverviewAction } from "@/modules/chat/actions";
import { ChatView } from "@/modules/chat/components/chat-view";
import { listActiveTeam } from "@/modules/team/queries";

export const metadata = { title: "Chat" };

export default async function ChatPage({ searchParams }: PageProps<"/chat">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const [overview, team] = await Promise.all([chatOverviewAction(), listActiveTeam()]);
  const requested = z.guid().safeParse(sp.c);
  const active = requested.success && overview.some((c) => c.id === requested.data) ? requested.data : null;
  const shown = active ?? overview[0]?.id ?? null;
  const thread = shown ? await chatMessagesAction(shown) : null;

  return (
    <div className="flex h-svh flex-col">
      <PageHeader title="Chat" icon={MessagesSquare} eyebrow="Team" description="Messaggi tra colleghi, in tempo reale" className="py-3" />
      <ChatView meId={user.id} team={team} initialOverview={overview} initialActive={active} initialThread={thread} />
    </div>
  );
}
