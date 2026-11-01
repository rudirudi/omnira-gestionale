"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { replaceUrl } from "@/lib/url-state";

/** Pulsante che apre un pannello/dialog impostando un parametro nell'URL, senza ricaricare la pagina */
export function UrlParamButton({
  param,
  value = "1",
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & { param: string; value?: string }) {
  const params = useSearchParams();
  return (
    <Button
      {...props}
      onClick={() => {
        const next = new URLSearchParams(params);
        next.set(param, value);
        replaceUrl(`${window.location.pathname}?${next.toString()}`);
      }}
    >
      {children}
    </Button>
  );
}
