import { AuthShell } from "@/components/app/auth-shell";
import { SignUpForm } from "./signup-form";

export const metadata = { title: "Registrati" };

export default function RegistratiPage() {
  return (
    <AuthShell title="Crea il tuo account" subtitle="Dopo la registrazione un amministratore attiverà il tuo accesso.">
      <SignUpForm />
    </AuthShell>
  );
}
