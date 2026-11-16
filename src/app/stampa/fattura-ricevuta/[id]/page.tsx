import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { InvoicePrint } from "@/modules/fatture/components/invoice-print";
import { getPurchaseXml } from "@/modules/fatture/queries";

const UUID = /^[0-9a-f-]{36}$/i;

export const metadata = { title: "Fattura ricevuta" };

export default async function StampaFatturaRicevuta({ params }: PageProps<"/stampa/fattura-ricevuta/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getCurrentUser();
  if (!can.viewMoney(user.role)) redirect("/");
  const r = await getPurchaseXml(id);
  if (!r?.parsed) notFound();
  return <InvoicePrint p={r.parsed} back="/fatture?tab=ricevute" backLabel="Torna alle fatture ricevute" />;
}
