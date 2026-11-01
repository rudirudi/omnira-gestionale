"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/app/action-form";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/action-result";
import { setNewPasswordAction } from "@/modules/auth/actions";

export function NewPasswordForm() {
  const [state, action] = useActionState(setNewPasswordAction, initialActionState);
  return (
    <ActionForm action={action} className="mt-8 flex flex-col gap-4">
      <Field label="Nuova password" htmlFor="np1" hint="Almeno 10 caratteri">
        <Input id="np1" name="password" type="password" autoComplete="new-password" required autoFocus />
      </Field>
      <Field label="Ripeti password" htmlFor="np2">
        <Input id="np2" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      {!state.ok && (
        <p className="text-[13px] text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton className="w-full">Salva e accedi</SubmitButton>
    </ActionForm>
  );
}
