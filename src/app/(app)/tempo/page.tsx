import { ComingSoon } from "@/components/app/coming-soon";
import { MODULES } from "@/lib/areas";

export const metadata = { title: "Tempo" };

export default function Page() {
  return (
    <ComingSoon
      mod={MODULES.tempo}
      features={[
        "Timer su un task o inserimento manuale",
        "Foglio settimanale con approvazione del PM",
        "Ore fatturabili e non, costo interno e margine",
      ]}
    />
  );
}
