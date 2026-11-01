"use client";

import { cn } from "@/lib/utils";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, Plus, Search, Target } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { globalSearch, type SearchHit } from "@/modules/search/actions";
import { ALL_NAV_ITEMS } from "./nav";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  React.useEffect(() => {
    if (query.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await globalSearch(query);
      if (!cancelled) setHits(res);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const visibleHits = query.trim().length < 2 ? [] : hits;

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <DialogPrimitive.Content className="fixed top-[15vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl">
          <DialogPrimitive.Title className="sr-only">Cerca e vai</DialogPrimitive.Title>
          <Command shouldFilter={false}>
            <CommandInput placeholder="Cerca progetti, clienti, lead o pagine…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>Nessun risultato.</CommandEmpty>
              {visibleHits.length > 0 && (
                <CommandGroup heading="Risultati">
                  {visibleHits.map((h) => (
                    <CommandItem key={`${h.kind}-${h.id}`} value={`${h.kind}-${h.id}`} onSelect={() => go(h.href)}>
                      {h.kind === "cliente" ? <Building2 /> : h.kind === "progetto" ? <Briefcase /> : <Target />}
                      <span className="truncate">{h.title}</span>
                      {h.subtitle && <span className="ml-auto truncate text-xs text-muted-foreground">{h.subtitle}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <CommandGroup heading="Azioni rapide">
                <CommandItem value="nuovo-task" onSelect={() => go("/task?nuovo=1")}>
                  <Plus /> Nuovo task
                </CommandItem>
                <CommandItem value="nuovo-progetto" onSelect={() => go("/progetti?nuovo=1")}>
                  <Plus /> Nuovo progetto
                </CommandItem>
                <CommandItem value="nuovo-cliente" onSelect={() => go("/clienti?nuovo=1")}>
                  <Plus /> Nuovo cliente
                </CommandItem>
                <CommandItem value="nuovo-lead" onSelect={() => go("/lead?nuovo=1")}>
                  <Plus /> Nuovo lead
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Vai a">
                {ALL_NAV_ITEMS.filter((i) => !query || i.label.toLowerCase().includes(query.toLowerCase())).map((i) => (
                  <CommandItem key={i.href} value={`nav-${i.href}`} onSelect={() => go(i.href)}>
                    <i.icon /> {i.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function SearchButton({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
      className={cn(
        "flex h-8 w-full max-w-sm items-center gap-2 rounded-md px-2.5 text-[13px] transition-colors",
        onDark
          ? "bg-white/10 text-white/75 ring-1 ring-white/20 hover:bg-white/15 hover:text-white"
          : "border bg-card text-muted-foreground shadow-xs hover:bg-muted",
        className,
      )}
    >
      <Search className="size-4" />
      <span className="flex-1 text-left">Cerca…</span>
      <kbd className={cn("hidden rounded px-1.5 font-mono text-[10px] sm:inline", onDark ? "bg-white/15 text-white/80" : "border bg-muted")}>Ctrl K</kbd>
    </button>
  );
}
