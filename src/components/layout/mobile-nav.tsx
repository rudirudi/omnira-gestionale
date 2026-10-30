"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Brand, SidebarNav } from "./sidebar";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Apri menu">
          <Menu />
        </Button>
      </DialogTrigger>
      <DialogContent side="left" className="flex flex-col gap-0 bg-sidebar">
        <DialogTitle className="sr-only">Menu</DialogTitle>
        <Brand />
        <SidebarNav onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
