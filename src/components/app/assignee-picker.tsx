"use client";

import { UserPlus } from "lucide-react";
import { AvatarStack } from "@/components/app/avatar-stack";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AssigneePicker({
  team,
  value,
  onChange,
  disabled,
}: {
  team: { id: string; full_name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const selected = team.filter((m) => value.includes(m.id));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="flex h-8 items-center gap-2 rounded-md px-1.5 text-[13px] outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        {selected.length ? (
          <>
            <AvatarStack names={selected.map((s) => s.full_name)} />
            <span className="truncate">{selected.length === 1 ? selected[0]!.full_name : `${selected.length} persone`}</span>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <UserPlus className="size-4" /> Assegna
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Assegnatari</DropdownMenuLabel>
        {team.map((m) => (
          <DropdownMenuCheckboxItem
            key={m.id}
            checked={value.includes(m.id)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(c) => onChange(c ? [...value, m.id] : value.filter((v) => v !== m.id))}
          >
            {m.full_name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
