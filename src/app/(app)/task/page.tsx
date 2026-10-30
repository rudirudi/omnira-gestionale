import { ComingSoon } from "@/components/app/coming-soon";

export const metadata = { title: "Task" };

export default function Page() {
  return (
    <ComingSoon
      title="Task"
      module="M4"
      phase={1}
      features={[
        'Viste Kanban, lista, calendario, timeline e "I miei task"',
        "Assegnatari, priorità, scadenze, stime, sotto-task e dipendenze",
        "Task ricorrenti (report SEO, backup, aggiornamenti)",
        "Collegamento a commit e pull request GitHub",
      ]}
    />
  );
}
