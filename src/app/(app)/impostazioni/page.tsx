import { Settings } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { EmailAdmin, EmailNotificationsToggle } from "@/modules/impostazioni/components/email-settings";
import { CompanyForm, MyProfileForm, TeamTable } from "@/modules/impostazioni/components/settings-forms";
import { createClient } from "@/lib/supabase/server";
import { getSettingsData } from "@/modules/impostazioni/queries";

export const metadata = { title: "Impostazioni" };

export default async function ImpostazioniPage({ searchParams }: PageProps<"/impostazioni">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const isAdmin = user.role === "admin";
  const [{ company, members, sites }, emailStatus] = await Promise.all([
    getSettingsData(),
    isAdmin ? createClient().then((db) => db.rpc("email_status")).then((r) => r.data ?? []) : Promise.resolve([]),
  ]);
  const tab = typeof sp.scheda === "string" ? sp.scheda : "profilo";

  return (
    <>
      <PageHeader title="Impostazioni" area="system" icon={Settings} description="Profilo, team e dati aziendali" />
      <PageBody>
        <Tabs defaultValue={tab}>
          <TabsList>
            <TabsTrigger value="profilo">Il mio profilo</TabsTrigger>
            <TabsTrigger value="team">Team ({members.filter((m) => m.active).length})</TabsTrigger>
            <TabsTrigger value="azienda">Azienda</TabsTrigger>
            {isAdmin && <TabsTrigger value="email">Email</TabsTrigger>}
          </TabsList>
          <TabsContent value="profilo">
            <MyProfileForm me={user} sites={sites} />
            <div className="mt-6 max-w-3xl">
              <EmailNotificationsToggle enabled={user.email_notifications} email={user.email} />
            </div>
          </TabsContent>
          <TabsContent value="team">
            <TeamTable members={members} sites={sites} canManage={can.manageTeam(user.role)} meId={user.id} />
          </TabsContent>
          <TabsContent value="azienda">
            {company && <CompanyForm company={company} canEdit={can.editCompanySettings(user.role)} />}
          </TabsContent>
          {isAdmin && (
            <TabsContent value="email">
              <EmailAdmin keyConfigured={emailStatus[0]?.key_configured ?? false} rows={emailStatus} />
            </TabsContent>
          )}
        </Tabs>
      </PageBody>
    </>
  );
}
