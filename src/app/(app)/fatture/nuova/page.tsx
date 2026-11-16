import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { InvoiceEditor } from "@/modules/fatture/components/invoice-editor";
import { getCompanySettings, listInvoiceClients, listProjectsForInvoices, listUninvoicedReceivables } from "@/modules/fatture/queries";

export const metadata = { title: "Nuova fattura" };

export default async function NuovaFattura({ searchParams }: PageProps<"/fatture/nuova">) {
  const user = await getCurrentUser();
  if (!can.manageMoney(user.role)) redirect("/fatture");
  const sp = await searchParams;
  const ids = (Array.isArray(sp.incasso) ? sp.incasso : sp.incasso ? [sp.incasso] : []).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  const [clients, projects, receivables, settings] = await Promise.all([listInvoiceClients(), listProjectsForInvoices(), listUninvoicedReceivables(), getCompanySettings()]);
  return (
    <>
      <PageHeader title="Nuova fattura" area="money" icon={Receipt} eyebrow="Fatture" description="Compila, controlla i totali e invia allo SDI. Puoi anche salvarla come bozza." />
      <PageBody>
        <InvoiceEditor
          clients={clients}
          projects={projects}
          receivables={receivables}
          defaultVat={Number(settings.default_vat_rate)}
          regime={settings.tax_regime}
          canManage
          initial={{ clientId: typeof sp.cliente === "string" ? sp.cliente : undefined, receivableIds: ids, projectId: typeof sp.progetto === "string" ? sp.progetto : undefined }}
        />
      </PageBody>
    </>
  );
}
