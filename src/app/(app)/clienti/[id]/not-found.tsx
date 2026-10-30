import Link from "next/link";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="p-6">
      <EmptyState
        icon={Building2}
        title="Cliente non trovato"
        description="Potrebbe essere stato archiviato oppure il link non è corretto."
        action={
          <Button asChild variant="outline">
            <Link href="/clienti">Torna ai clienti</Link>
          </Button>
        }
      />
    </div>
  );
}
