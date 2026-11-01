import { ComingSoon } from "@/components/app/coming-soon";
import { MODULES } from "@/lib/areas";

export const metadata = { title: "Ticket" };

export default function Page() {
  return (
    <ComingSoon
      mod={MODULES.ticket}
      features={[
        "Segnalazioni da email, chatbot o inserite dal team",
        "Stati Inviata → Presa in carico → In lavorazione → Risolta",
        "SLA per contratto, ticket → task di progetto",
      ]}
    />
  );
}
