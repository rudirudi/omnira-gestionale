"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Brand, SidebarNav } from "./sidebar";

export function MobileNav({ hidden = [], onDark = false }: { hidden?: string[]; onDark?: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className={onDark ? "text-white hover:bg-white/15 hover:text-white lg:hidden" : "lg:hidden"} aria-label="Apri menu">
          <Menu />
        </Button>
      </DialogTrigger>
      <DialogContent side="left" className="flex flex-col gap-0 border-sidebar-border bg-sidebar text-sidebar-foreground [&>button]:text-sidebar-foreground">
        <DialogTitle className="sr-only">Menu</DialogTitle>
        <Brand />
        <SidebarNav hidden={hidden} onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
