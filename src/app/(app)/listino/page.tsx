import { redirect } from "next/navigation";
import { Tags } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PriceList } from "@/modules/listino/components/price-list";
import { listServices } from "@/modules/listino/queries";

export const metadata = { title: "Listino" };

export default async function ListinoPage() {
  const user = await getCurrentUser();
  if (!can.viewMoney(user.role)) redirect("/");
  const services = await listServices();
  return (
    <>
      <PageHeader title="Listino servizi" area="sales" icon={Tags} description="I vostri prezzi standard, IVA esclusa. Nei preventivi: «Aggiungi dal listino»." />
      <PageBody>
        <PriceList services={services} isAdmin={user.role === "admin"} />
      </PageBody>
    </>
  );
}
