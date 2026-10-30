import { ComingSoon } from "@/components/app/coming-soon";

export const metadata = { title: "Report" };

export default function Page() {
  return (
    <ComingSoon
      title="Report"
      module="M12"
      phase={4}
      features={[
        "Marginalità per progetto e cliente",
        "Carico di lavoro del team",
        "Previsione di cassa a 90 giorni, conversione per fonte",
      ]}
    />
  );
}
