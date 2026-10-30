"use client";

import { use } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormPendingContext } from "./action-form";

export function SubmitButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  const { pending: nativePending } = useFormStatus();
  const ctxPending = use(FormPendingContext);
  const pending = nativePending || ctxPending;
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}
