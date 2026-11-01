import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, FileSignature } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { QuoteEditor } from "@/modules/preventivi/components/quote-editor";
import { listServices } from "@/modules/listino/queries";
import { getQuote } from "@/modules/preventivi/queries";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: PageProps<"/preventivi/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Preventivo" };
  const q = await getQuote(id);
  return { title: q ? `${q.number} ${q.title}` : "Preventivo" };
}

export default async function PreventivoPage({ params }: PageProps<"/preventivi/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getCurrentUser();
  if (!can.viewMoney(user.role)) redirect("/");
  const [quote, services] = await Promise.all([getQuote(id), listServices({ onlyActive: true })]);
  if (!quote) notFound();
  return (
    <>
      <PageHeader
        title={quote.title}
        area="sales"
        icon={FileSignature}
        eyebrow={`Preventivo · ${quote.number}`}
        description={`Del ${formatDate(quote.issue_date)} · per ${quote.client?.name ?? quote.lead?.company_name ?? quote.lead?.title ?? "—"}`}
        actions={
          <Link href="/preventivi" className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Preventivi
          </Link>
        }
      />
      <PageBody className="pt-0">
        <QuoteEditor quote={quote} services={services} canAccept={can.manageMoney(user.role)} canCreateProject={can.manageProjects(user.role)} isAdmin={user.role === "admin"} />
      </PageBody>
    </>
  );
}
