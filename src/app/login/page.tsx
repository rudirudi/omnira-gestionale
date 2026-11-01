import { AuthShell } from "@/components/app/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Accedi" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const errore = typeof sp.errore === "string" ? sp.errore : undefined;
  const message =
    errore === "disattivato"
      ? "Il tuo account non è ancora attivo: un amministratore deve attivarlo da Impostazioni → Team."
      : errore === "google"
        ? "Accesso con Google non riuscito. Riprova o usa email e password."
        : errore === "scaduto"
          ? "Il link è scaduto: richiedine uno nuovo con \"Password dimenticata?\"."
          : errore === "link"
            ? "Il link non è valido o è già stato usato. Richiedine uno nuovo."
            : undefined;

  return (
    <AuthShell title="Accedi" subtitle="Usa l'account aziendale Omnira Soft.">
      <LoginForm next={next} initialError={message} />
    </AuthShell>
  );
}
