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
        : errore === "link"
          ? "Il link non è valido o è scaduto."
          : undefined;

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col justify-between p-6 sm:p-10">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">O</span>
          <span className="text-sm font-semibold">Omnira Gestionale</span>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Accedi</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Usa l&apos;account aziendale Omnira Soft.</p>
          <LoginForm next={next} initialError={message} />
        </div>
        <p className="text-xs text-muted-foreground">Accesso riservato al team. Problemi? Scrivi a un amministratore.</p>
      </div>
      <div className="relative hidden overflow-hidden border-l bg-sidebar lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-end gap-4 p-12">
          <p className="max-w-md text-2xl leading-snug font-semibold tracking-tight">
            Clienti, progetti, task e pagamenti. Un solo posto, per tutto il team.
          </p>
          <p className="max-w-md text-[13px] text-muted-foreground">Terni · Longobucco · da remoto</p>
        </div>
      </div>
    </div>
  );
}
