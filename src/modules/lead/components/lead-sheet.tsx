"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityTimeline } from "@/modules/clienti/components/activity-timeline";
import { LEAD_STAGE } from "@/lib/labels";
import { convertLeadToClientAction, fetchLeadActivitiesAction, updateLeadAction } from "../actions";
import type { LeadWithRefs } from "../queries";
import { LeadForm } from "./lead-form";

type Activities = Awaited<ReturnType<typeof fetchLeadActivitiesAction>>;

export function LeadSheet({
  lead,
  team,
  canEdit,
  onClose,
}: {
  lead: LeadWithRefs | null;
  team: { id: string; full_name: string }[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loaded, setLoaded] = React.useState<{ id: string; items: Activities } | null>(null);
  const [converting, startConvert] = React.useTransition();

  const leadId = lead?.id;
  const load = React.useCallback(() => {
    if (leadId) fetchLeadActivitiesAction(leadId).then((items) => setLoaded({ id: leadId, items }));
  }, [leadId]);
  React.useEffect(() => {
    load();
  }, [load]);
  const activities = loaded && loaded.id === leadId ? loaded.items : [];

  const update = React.useMemo(() => (lead ? updateLeadAction.bind(null, lead.id) : null), [lead]);

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right" className="flex flex-col gap-0 overflow-y-auto p-0">
        {lead && update && (
          <>
            <DialogHeader className="border-b p-5 pr-12">
              <div className="flex items-center gap-2">
                <Badge tone={LEAD_STAGE[lead.stage].tone}>{LEAD_STAGE[lead.stage].label}</Badge>
              </div>
              <DialogTitle className="text-lg">{lead.title}</DialogTitle>
              <DialogDescription>{lead.company_name ?? "Azienda non indicata"}</DialogDescription>
              {lead.client ? (
                <Link href={`/clienti/${lead.client.id}`} className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline">
                  <Building2 className="size-3.5" /> Cliente: {lead.client.name}
                </Link>
              ) : (
                canEdit &&
                lead.stage === "vinto" && (
                  <Button
                    size="sm"
                    className="mt-2 w-fit"
                    disabled={converting}
                    onClick={() =>
                      startConvert(async () => {
                        const r = await convertLeadToClientAction(lead.id);
                        if (r.ok && r.data) router.push(`/clienti/${r.data.clientId}`);
                        else if (!r.ok) toast.error(r.error);
                      })
                    }
                  >
                    <Building2 /> Crea cliente da questo lead
                  </Button>
                )
              )}
              {canEdit && lead.stage !== "vinto" && lead.stage !== "perso" && (
                <Link
                  href={`/preventivi?nuovo=1&lead=${lead.id}`}
                  className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-md bg-sales px-2.5 py-1.5 text-[13px] font-semibold text-on-warning hover:bg-sales/90"
                >
                  <FileSignature className="size-4" /> Crea preventivo
                </Link>
              )}
            </DialogHeader>
            <Tabs defaultValue="dettagli" className="p-5">
              <TabsList>
                <TabsTrigger value="dettagli">Dettagli</TabsTrigger>
                <TabsTrigger value="attivita">Attività ({activities.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="dettagli">
                <LeadForm key={lead.id} action={update} defaults={lead} team={team} submitLabel="Salva modifiche" readOnly={!canEdit} />
              </TabsContent>
              <TabsContent value="attivita">
                <ActivityTimeline activities={activities} leadId={lead.id} onChanged={load} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
