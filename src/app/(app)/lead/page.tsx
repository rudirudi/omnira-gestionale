import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatEuro } from "@/lib/utils";
import { listTeam } from "@/modules/clienti/queries";
import { LeadBoard } from "@/modules/lead/components/lead-board";
import { listLeads } from "@/modules/lead/queries";

export const metadata = { title: "Lead" };

export default async function LeadPage() {
  const [user, leads, team] = await Promise.all([getCurrentUser(), listLeads(), listTeam()]);
  const open = leads.filter((l) => l.stage !== "vinto" && l.stage !== "perso");
  const value = open.reduce((s, l) => s + (l.estimated_value_cents ?? 0), 0);
  const canEdit = can.editLeads(user.role);

  return (
    <>
      <PageHeader
        title="Lead"
        description={`${open.length} aperti · ${formatEuro(value)} in pipeline${canEdit ? " · trascina le card per cambiare fase" : ""}`}
        actions={
          canEdit && (
            <Button asChild>
              <Link href="/lead?nuovo=1" scroll={false}>
                <Plus /> Nuovo lead
              </Link>
            </Button>
          )
        }
      />
      <PageBody>
        <LeadBoard leads={leads} team={team} canEdit={canEdit} />
      </PageBody>
    </>
  );
}
