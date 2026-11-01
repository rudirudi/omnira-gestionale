import { ComingSoon } from "@/components/app/coming-soon";
import { MODULES } from "@/lib/areas";

export const metadata = { title: "Preventivi" };

export default function Page() {
  return (
    <ComingSoon
      mod={MODULES.preventivi}
      features={[
        "Catalogo servizi dal listino Omnira",
        "PDF brandizzato e accettazione online",
        "Preventivo accettato → progetto con piano di pagamento",
      ]}
    />
  );
}
