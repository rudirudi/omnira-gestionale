import { Settings } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { NotificationServices, NotificationSettings } from "@/modules/impostazioni/components/notification-settings";
import { CompanyForm, MyProfileForm, TeamTable } from "@/modules/impostazioni/components/settings-forms";
import { createClient } from "@/lib/supabase/server";
import { getSettingsData } from "@/modules/impostazioni/queries";

export const metadata = { title: "Impostazioni" };

export default async function ImpostazioniPage({ searchParams }: PageProps<"/impostazioni">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const isAdmin = user.role === "admin";
  const db = await createClient();
  const [{ company, members, sites }, prefs, channels, log] = await Promise.all([
    getSettingsData(),
    db
      .from("profiles")
      .select("email, email_notifications, notification_email, notify_telegram, telegram_chat_id, telegram_username, notify_whatsapp, whatsapp_number")
      .eq("id", user.id)
      .single()
      .then((r) => r.data),
    db.rpc("notification_channels").then((r) => r.data?.[0] ?? { email_ready: false, telegram_ready: false, telegram_bot: null }),
    isAdmin ? db.rpc("email_status").then((r) => r.data ?? []) : Promise.resolve([]),
  ]);
  const tab = typeof sp.scheda === "string" ? sp.scheda : "profilo";

  return (
    <>
      <PageHeader title="Impostazioni" area="system" icon={Settings} description="Profilo, notifiche, team e dati aziendali" />
      <PageBody>
        <Tabs defaultValue={tab}>
          <TabsList>
            <TabsTrigger value="profilo">Il mio profilo</TabsTrigger>
            <TabsTrigger value="team">Team ({members.filter((m) => m.active).length})</TabsTrigger>
            <TabsTrigger value="azienda">Azienda</TabsTrigger>
            <TabsTrigger value="notifiche">Notifiche</TabsTrigger>
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
          <TabsContent value="notifiche" className="flex flex-col gap-8">
            {prefs && <NotificationSettings prefs={prefs} channels={channels} />}
            {isAdmin && <NotificationServices channels={channels} log={log} />}
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}
