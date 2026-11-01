"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/app/action-form";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/action-result";
import { sendPasswordReset, signIn, signInWithGoogle } from "@/modules/auth/actions";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action] = useActionState(signIn, initialActionState);
  const [resetState, resetAction] = useActionState(sendPasswordReset, initialActionState);
  const [mode, setMode] = useState<"login" | "reset">("login");
  // Controllato: React azzera i form dopo l'invio, l'email deve restare se la password è sbagliata
  const [email, setEmail] = useState("");
  const error = !state.ok ? state.error : initialError;

  if (mode === "reset") {
    return (
      <ActionForm action={resetAction} className="mt-8 flex flex-col gap-4">
        <Field label="Email" htmlFor="r_email">
          <Input id="r_email" name="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {resetState.ok && resetState.message && <p className="rounded-md bg-success/10 p-3 text-[13px] text-success">{resetState.message}</p>}
        {!resetState.ok && <p className="text-[13px] text-destructive">{resetState.error}</p>}
        <SubmitButton className="w-full">Invia link di reimpostazione</SubmitButton>
        <Button type="button" variant="link" size="sm" onClick={() => setMode("login")}>
          Torna all&apos;accesso
        </Button>
      </ActionForm>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-5">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="outline" className="w-full">
          <svg viewBox="0 0 24 24" aria-hidden className="size-4">
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1Z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
          </svg>
          Continua con Google
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> oppure <span className="h-px flex-1 bg-border" />
      </div>
      <ActionForm action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="nome@omnirasoft.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        {error && (
          <p className="text-[13px] text-destructive" role="alert">
            {error}
          </p>
        )}
        <SubmitButton className="w-full">Accedi</SubmitButton>
        <Button type="button" variant="link" size="sm" onClick={() => setMode("reset")}>
          Password dimenticata?
        </Button>
      </ActionForm>
      <p className="text-center text-[13px] text-muted-foreground">
        Non hai un account?{" "}
        <Link href="/registrati" className="font-medium text-primary hover:underline">
          Registrati
        </Link>
      </p>
    </div>
  );
}
