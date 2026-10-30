"use client";

import { useState, useTransition } from "react";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { archiveClientAction } from "../actions";

export function ArchiveClientButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Archive /> Archivia
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archiviare {name}?</DialogTitle>
          <DialogDescription>Il cliente sparisce dalle liste ma resta nello storico. Si può ripristinare dal database.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Annulla
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await archiveClientAction(id);
                if (r && !r.ok) toast.error(r.error);
              })
            }
          >
            Archivia cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
