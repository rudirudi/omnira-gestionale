import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Globe, Mail, MapPin, Phone } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth";
import { CLIENT_STATUS, LEAD_STAGE } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { formatEuro } from "@/lib/utils";
import { updateClientAction } from "@/modules/clienti/actions";
import { ActivityTimeline } from "@/modules/clienti/components/activity-timeline";
import { ArchiveClientButton } from "@/modules/clienti/components/archive-client-button";
import { ClientForm } from "@/modules/clienti/components/client-form";
import { ContactsPanel } from "@/modules/clienti/components/contacts-panel";
import { getClient, getClientRelated, listTeam } from "@/modules/clienti/queries";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: PageProps<"/clienti/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Cliente" };
  const c = await getClient(id);
  return { title: c?.name ?? "Cliente" };
}

export default async function ClientePage({ params, searchParams }: PageProps<"/clienti/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const [user, client, team] = await Promise.all([getCurrentUser(), getClient(id), listTeam()]);
  if (!client) notFound();
  const { contacts, activities, leads } = await getClientRelated(id);
  const canEdit = can.editClients(user.role);
  const tab = typeof sp.scheda === "string" ? sp.scheda : "panoramica";
  const update = updateClientAction.bind(null, id);

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {client.name}
            <Badge tone={CLIENT_STATUS[client.status].tone}>{CLIENT_STATUS[client.status].label}</Badge>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {client.city && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {client.city}
                {client.province ? ` (${client.province})` : ""}
              </span>
            )}
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-foreground">
                <Mail className="size-3.5" /> {client.email}
              </a>
            )}
            {client.phone && (
              <a href={`tel:${client.phone}`} className="flex items-center gap-1 hover:text-foreground">
                <Phone className="size-3.5" /> {client.phone}
              </a>
            )}
            {client.website && (
              <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                <Globe className="size-3.5" /> Sito
              </a>
            )}
          </span>
        }
        actions={
          <>
            <Link href="/clienti" className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
              <ChevronLeft className="size-4" /> Clienti
            </Link>
            {can.deleteRecords(user.role) && <ArchiveClientButton id={id} name={client.name} />}
          </>
        }
      />
      <PageBody>
        <Tabs defaultValue={tab}>
          <TabsList>
            <TabsTrigger value="panoramica">Anagrafica</TabsTrigger>
            <TabsTrigger value="referenti">Referenti ({contacts.length})</TabsTrigger>
            <TabsTrigger value="attivita">Attività ({activities.length})</TabsTrigger>
            <TabsTrigger value="lead">Lead ({leads.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="panoramica" className="max-w-3xl">
            <ClientForm action={update} defaults={client} team={team} submitLabel="Salva modifiche" readOnly={!canEdit} />
          </TabsContent>
          <TabsContent value="referenti">
            <ContactsPanel clientId={id} contacts={contacts} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="attivita" className="max-w-3xl">
            <ActivityTimeline activities={activities} clientId={id} />
          </TabsContent>
          <TabsContent value="lead">
            {leads.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Nessun lead collegato a questo cliente.</p>
            ) : (
              <ul className="flex max-w-3xl flex-col divide-y rounded-lg border bg-card">
                {leads.map((l) => (
                  <li key={l.id}>
                    <Link href={`/lead?aperto=${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                      <span className="flex-1 font-medium">{l.title}</span>
                      <span className="text-[13px] tabular">{formatEuro(l.estimated_value_cents)}</span>
                      <Badge tone={LEAD_STAGE[l.stage].tone}>{LEAD_STAGE[l.stage].label}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}
