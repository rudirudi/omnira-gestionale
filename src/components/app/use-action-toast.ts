"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/** Mostra un toast quando lo stato di una Server Action cambia. */
export function useActionToast(state: ActionResult, onSuccess?: () => void) {
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      onSuccess?.();
    } else {
      toast.error(state.error);
    }
  }, [state, onSuccess]);
}
