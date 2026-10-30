import { PageBody, PageHeader } from "@/components/app/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CompanyForm, MyProfileForm, TeamTable } from "@/modules/impostazioni/components/settings-forms";
import { getSettingsData } from "@/modules/impostazioni/queries";

export const metadata = { title: "Impostazioni" };

export default async function ImpostazioniPage({ searchParams }: PageProps<"/impostazioni">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const { company, members, sites } = await getSettingsData();
  const tab = typeof sp.scheda === "string" ? sp.scheda : "profilo";

  return (
    <>
      <PageHeader title="Impostazioni" description="Profilo, team e dati aziendali" />
      <PageBody>
        <Tabs defaultValue={tab}>
          <TabsList>
            <TabsTrigger value="profilo">Il mio profilo</TabsTrigger>
            <TabsTrigger value="team">Team ({members.filter((m) => m.active).length})</TabsTrigger>
            <TabsTrigger value="azienda">Azienda</TabsTrigger>
          </TabsList>
          <TabsContent value="profilo">
            <MyProfileForm me={user} sites={sites} />
          </TabsContent>
          <TabsContent value="team">
            <TeamTable members={members} sites={sites} canManage={can.manageTeam(user.role)} meId={user.id} />
          </TabsContent>
          <TabsContent value="azienda">
            {company && <CompanyForm company={company} canEdit={can.editCompanySettings(user.role)} />}
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}
