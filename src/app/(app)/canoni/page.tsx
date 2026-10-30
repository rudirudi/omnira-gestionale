import { ComingSoon } from "@/components/app/coming-soon";

export const metadata = { title: "Canoni" };

export default function Page() {
  return (
    <ComingSoon
      title="Canoni"
      module="M9"
      phase={2}
      features={[
        "Manutenzioni, SEO mensile, AI Chat e AI Voice",
        "Fatturazione ricorrente automatica",
        "Rinnovi domini e hosting, ricavi ricorrenti mensili",
      ]}
    />
  );
}
