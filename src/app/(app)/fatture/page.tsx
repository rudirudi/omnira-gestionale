import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { InvoicesView } from "@/modules/fatture/components/invoices-view";
import { getInvoicingInfo, listInvoices, listProjectsForInvoices, listPurchaseInvoices } from "@/modules/fatture/queries";

export const metadata = { title: "Fatture" };

export default async function FatturePage({ searchParams }: PageProps<"/fatture">) {
  const user = await getCurrentUser();
  if (!can.viewMoney(user.role)) redirect("/");
  const sp = await searchParams;
  if (typeof sp.aperta === "string") redirect(`/fatture/${sp.aperta}`);
  const [invoices, purchases, info, projects] = await Promise.all([listInvoices(), listPurchaseInvoices(), getInvoicingInfo(), listProjectsForInvoices()]);
  return (
    <>
      <PageHeader
        title="Fatture"
        area="money"
        icon={Receipt}
        description="Fatture elettroniche emesse ai clienti e ricevute dai fornitori, collegate allo SDI tramite Invoicetronic."
      />
      <PageBody>
        <InvoicesView
          invoices={invoices}
          purchases={purchases}
          info={info}
          projects={projects}
          canManage={can.manageMoney(user.role)}
          isAdmin={user.role === "admin"}
          initialTab={sp.tab === "ricevute" ? "ricevute" : "emesse"}
          today={new Date().toISOString().slice(0, 10)}
        />
      </PageBody>
    </>
  );
}
