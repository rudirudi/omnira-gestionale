import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Configurazione" };

export default function ConfigurazionePage() {
  if (isSupabaseConfigured) redirect("/");
  return (
    <div className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Collega il database</h1>
      <p className="text-[13px] text-muted-foreground">
        Mancano le variabili d&apos;ambiente di Supabase. Copia <code className="font-mono">.env.example</code> in{" "}
        <code className="font-mono">.env.local</code> e inserisci URL e chiave pubblica del progetto (Supabase → Project Settings → API), poi riavvia il server.
      </p>
      <pre className="rounded-lg border bg-card p-4 font-mono text-xs">
        {`NEXT_PUBLIC_SUPABASE_URL=https://<progetto>.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<chiave pubblica>`}
      </pre>
    </div>
  );
}
