"use client";

import { useSearchParams } from "next/navigation";
import { replaceUrl } from "@/lib/url-state";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createClientAction } from "../actions";
import { ClientForm } from "./client-form";

export function NewClientDialog({ team }: { team: { id: string; full_name: string }[] }) {
  const params = useSearchParams();
  const open = params.get("nuovo") === "1";

  const setOpen = (o: boolean) => {
    const next = new URLSearchParams(params);
    if (o) next.set("nuovo", "1");
    else next.delete("nuovo");
    replaceUrl(`${window.location.pathname}?${next.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Nuovo cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuovo cliente</DialogTitle>
          <DialogDescription>I dati di fatturazione si completano dopo, nella scheda del cliente.</DialogDescription>
        </DialogHeader>
        <ClientForm action={createClientAction} team={team} submitLabel="Crea cliente" compact />
      </DialogContent>
    </Dialog>
  );
}
