"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { ActionForm } from "@/components/app/action-form";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/action-result";
import { signInWithGoogle, signUp } from "@/modules/auth/actions";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, initialActionState);
  const [values, setValues] = useState({ full_name: "", email: "" });

  if (state.ok && state.message) {
    return (
      <div className="mt-8 flex flex-col gap-4 rounded-xl border border-success/30 bg-success/[0.06] p-5">
        <CheckCircle2 className="size-6 text-success" />
        <p className="text-[13px] leading-relaxed">{state.message}</p>
        <Button asChild variant="outline">
          <Link href="/login">Torna all&apos;accesso</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-5">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value="/" />
        <Button type="submit" variant="outline" className="w-full">
          <svg viewBox="0 0 24 24" aria-hidden className="size-4">
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1Z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
          </svg>
          Registrati con Google
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> oppure con email <span className="h-px flex-1 bg-border" />
      </div>
      <ActionForm action={action} className="flex flex-col gap-4">
        <Field label="Nome e cognome" htmlFor="su_name">
          <Input id="su_name" name="full_name" autoComplete="name" required value={values.full_name} onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))} />
        </Field>
        <Field label="Email" htmlFor="su_email">
          <Input id="su_email" name="email" type="email" autoComplete="email" required value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} />
        </Field>
        <Field label="Password" htmlFor="su_pw" hint="Almeno 10 caratteri">
          <Input id="su_pw" name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field label="Ripeti password" htmlFor="su_pw2">
          <Input id="su_pw2" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        {!state.ok && (
          <p className="text-[13px] text-destructive" role="alert">
            {state.error}
          </p>
        )}
        <SubmitButton className="w-full">Crea account</SubmitButton>
      </ActionForm>
      <p className="text-center text-[13px] text-muted-foreground">
        Hai già un account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Accedi
        </Link>
      </p>
    </div>
  );
}
