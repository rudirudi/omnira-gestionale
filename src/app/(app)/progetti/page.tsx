import { ComingSoon } from "@/components/app/coming-soon";

export const metadata = { title: "Progetti" };

export default function Page() {
  return (
    <ComingSoon
      title="Progetti"
      module="M3"
      phase={1}
      features={[
        "Template per sito, e-commerce, software, app, automazione AI",
        "Fasi Analisi → Progettazione → Sviluppo → Test → Rilascio con avanzamento",
        "Sprint di 1–2 settimane, milestone e note di rilascio",
        "Budget a corpo, a ore o a canone con confronto sulle ore consumate",
      ]}
    />
  );
}
