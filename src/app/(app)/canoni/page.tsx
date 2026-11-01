import { ComingSoon } from "@/components/app/coming-soon";
import { MODULES } from "@/lib/areas";

export const metadata = { title: "Canoni" };

export default function Page() {
  return (
    <ComingSoon
      mod={MODULES.canoni}
      features={[
        "Manutenzioni, SEO mensile, AI Chat e AI Voice",
        "Fatturazione ricorrente automatica",
        "Rinnovi domini e hosting, ricavi ricorrenti mensili",
      ]}
    />
  );
}
