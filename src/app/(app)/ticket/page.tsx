import { ComingSoon } from "@/components/app/coming-soon";

export const metadata = { title: "Ticket" };

export default function Page() {
  return (
    <ComingSoon
      title="Ticket"
      module="M10"
      phase={3}
      features={[
        "Segnalazioni da email, chatbot o inserite dal team",
        "Stati Inviata → Presa in carico → In lavorazione → Risolta",
        "SLA per contratto, ticket → task di progetto",
      ]}
    />
  );
}
