import { CalendarClock } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listProjectOptions } from "@/modules/incassi/queries";
import { listClientOptions } from "@/modules/progetti/queries";
import { RenewalsView } from "@/modules/scadenze/components/renewals-view";
import { listRenewals } from "@/modules/scadenze/queries";

export const metadata = { title: "Scadenze" };

export default async function ScadenzePage() {
  const [user, items, clients, projects] = await Promise.all([
    getCurrentUser(),
    listRenewals({ includeInactive: true }),
    listClientOptions(),
    listProjectOptions(),
  ]);
  return (
    <>
      <PageHeader
        title="Scadenze e rinnovi"
        area="money"
        icon={CalendarClock}
        description="Domini, hosting, server, licenze: avviso automatico prima di ogni scadenza."
      />
      <PageBody>
        <RenewalsView items={items} clients={clients} projects={projects} canManage={can.manageMoney(user.role)} />
      </PageBody>
    </>
  );
}
