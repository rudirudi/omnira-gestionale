"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createProjectAction } from "../actions";
import { ProjectForm } from "./project-form";

export function NewProjectDialog({ clients, team }: { clients: { id: string; name: string }[]; team: { id: string; full_name: string }[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const open = params.get("nuovo") === "1";
  const setOpen = (o: boolean) => {
    const next = new URLSearchParams(params);
    if (o) next.set("nuovo", "1");
    else next.delete("nuovo");
    router.replace(`/progetti?${next.toString()}`, { scroll: false });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Nuovo progetto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo progetto</DialogTitle>
          <DialogDescription>Il codice (es. P-2026-001) e le fasi vengono creati in automatico.</DialogDescription>
        </DialogHeader>
        <ProjectForm action={createProjectAction} clients={clients} team={team} submitLabel="Crea progetto" isNew />
      </DialogContent>
    </Dialog>
  );
}
