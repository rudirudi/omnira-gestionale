import { ComingSoon } from "@/components/app/coming-soon";
import { MODULES } from "@/lib/areas";

export const metadata = { title: "Fatture" };

export default function Page() {
  return (
    <ComingSoon
      mod={MODULES.fatture}
      features={[
        "Fatture, acconti, SAL e saldo dal piano di pagamento",
        "Invio allo SDI tramite provider con API",
        "Scadenzario, solleciti automatici, pagamento Stripe",
      ]}
    />
  );
}
