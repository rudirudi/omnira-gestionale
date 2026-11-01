import { ComingSoon } from "@/components/app/coming-soon";
import { MODULES } from "@/lib/areas";

export const metadata = { title: "Report" };

export default function Page() {
  return (
    <ComingSoon
      mod={MODULES.report}
      features={[
        "Marginalità per progetto e cliente",
        "Carico di lavoro del team",
        "Previsione di cassa a 90 giorni, conversione per fonte",
      ]}
    />
  );
}
