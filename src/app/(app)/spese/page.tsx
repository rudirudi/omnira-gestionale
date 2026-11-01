import { HandCoins } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listProjectOptions } from "@/modules/incassi/queries";
import { SpeseView } from "@/modules/spese/components/expenses-view";
import { listExpenses, listIncomeDays, listSubscriptions } from "@/modules/spese/queries";
import { listActiveTeam } from "@/modules/team/queries";

export const metadata = { title: "Spese" };

export default async function SpesePage() {
  const user = await getCurrentUser();
  const canManage = can.manageMoney(user.role);
  const showBalance = can.viewMoney(user.role) && canManage;
  const [expenses, subscriptions, income, people, projects] = await Promise.all([
    listExpenses(),
    listSubscriptions(),
    showBalance ? listIncomeDays() : Promise.resolve([]),
    listActiveTeam(),
    listProjectOptions(),
  ]);
  return (
    <>
      <PageHeader
        title="Spese"
        area="money"
        icon={HandCoins}
        description={canManage ? "Quanto spendete, chi ha pagato e per cosa. Gli abbonamenti si sommano da soli a ogni addebito." : "Le tue spese: registra quello che paghi per il lavoro."}
      />
      <PageBody>
        <SpeseView
          expenses={expenses}
          subscriptions={subscriptions}
          income={income}
          people={people}
          projects={projects}
          meId={user.id}
          canManage={canManage}
          isAdmin={user.role === "admin"}
          showBalance={showBalance}
        />
      </PageBody>
    </>
  );
}
