import { redirect } from "next/navigation";
import { FileSignature } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { QuotesList } from "@/modules/preventivi/components/quotes-list";
import { listQuotes, listRecipients } from "@/modules/preventivi/queries";

export const metadata = { title: "Preventivi" };

export default async function PreventiviPage({ searchParams }: PageProps<"/preventivi">) {
  const user = await getCurrentUser();
  if (!can.viewMoney(user.role)) redirect("/");
  const sp = await searchParams;
  const [quotes, recipients] = await Promise.all([listQuotes(), listRecipients()]);
  const lead = typeof sp.lead === "string" ? `lead:${sp.lead}` : undefined;
  const client = typeof sp.cliente === "string" ? `client:${sp.cliente}` : undefined;
  return (
    <>
      <PageHeader
        title="Preventivi"
        area="sales"
        icon={FileSignature}
        description="Dal lead al progetto: quando il cliente accetta, il preventivo diventa progetto, incassi e scadenze."
      />
      <PageBody>
        <QuotesList quotes={quotes} recipients={recipients} initialRecipient={lead ?? client} openNew={sp.nuovo === "1"} />
      </PageBody>
    </>
  );
}
