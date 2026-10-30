"use client";

import { createContext, useTransition } from "react";

export const FormPendingContext = createContext(false);

/**
 * Form che invia a una Server Action senza il reset automatico di React 19:
 * se la validazione fallisce, i campi restano compilati. Il reset dopo un
 * successo si fa esplicitamente (formRef.current?.reset()).
 */
export function ActionForm({
  action,
  children,
  ...props
}: Omit<React.ComponentProps<"form">, "action" | "onSubmit"> & { action: (fd: FormData) => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <FormPendingContext value={pending}>
      <form
        {...props}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => action(fd));
        }}
      >
        {children}
      </form>
    </FormPendingContext>
  );
}
