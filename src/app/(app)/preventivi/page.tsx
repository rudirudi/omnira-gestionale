import { ComingSoon } from "@/components/app/coming-soon";

export const metadata = { title: "Preventivi" };

export default function Page() {
  return (
    <ComingSoon
      title="Preventivi"
      module="M7"
      phase={2}
      features={[
        "Catalogo servizi dal listino Omnira",
        "PDF brandizzato e accettazione online",
        "Preventivo accettato → progetto con piano di pagamento",
      ]}
    />
  );
}
