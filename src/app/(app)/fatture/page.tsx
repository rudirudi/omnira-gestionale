import { ComingSoon } from "@/components/app/coming-soon";

export const metadata = { title: "Fatture" };

export default function Page() {
  return (
    <ComingSoon
      title="Fatture"
      module="M8"
      phase={2}
      features={[
        "Fatture, acconti, SAL e saldo dal piano di pagamento",
        "Invio allo SDI tramite provider con API",
        "Scadenzario, solleciti automatici, pagamento Stripe",
      ]}
    />
  );
}
