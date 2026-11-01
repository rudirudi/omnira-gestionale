import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ReceivablesView } from "@/modules/incassi/components/receivables-view";
import { listProjectOptions, listReceivables } from "@/modules/incassi/queries";
import { listClientOptions } from "@/modules/progetti/queries";

export const metadata = { title: "Incassi" };

export default async function IncassiPage() {
  const user = await getCurrentUser();
  if (!can.viewMoney(user.role)) redirect("/");
  const [items, clients, projects] = await Promise.all([listReceivables(), listClientOptions(), listProjectOptions()]);
  return (
    <>
      <PageHeader title="Incassi" area="money" icon={Wallet} description="Quanto devono pagare i clienti, quanto hanno già pagato e cosa manca." />
      <PageBody>
        <ReceivablesView items={items} clients={clients} projects={projects} canManage={can.manageMoney(user.role)} canDelete={user.role === "admin"} />
      </PageBody>
    </>
  );
}
