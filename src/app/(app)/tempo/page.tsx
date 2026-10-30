import { ComingSoon } from "@/components/app/coming-soon";

export const metadata = { title: "Tempo" };

export default function Page() {
  return (
    <ComingSoon
      title="Tempo"
      module="M6"
      phase={2}
      features={[
        "Timer su un task o inserimento manuale",
        "Foglio settimanale con approvazione del PM",
        "Ore fatturabili e non, costo interno e margine",
      ]}
    />
  );
}
