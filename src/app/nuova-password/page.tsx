import { redirect } from "next/navigation";
import { AuthShell } from "@/components/app/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./new-password-form";

export const metadata = { title: "Nuova password" };

export default async function NuovaPasswordPage() {
  // Si arriva qui dal link email (reset o invito), che ha già aperto la sessione
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login?errore=link");
  return (
    <AuthShell title="Scegli la nuova password" subtitle={`Account: ${String(data.claims.email ?? "")}`}>
      <NewPasswordForm />
    </AuthShell>
  );
}
