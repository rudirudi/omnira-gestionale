"use client";
import * as React from "react";
import { Command as C } from "cmdk";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Command({ className, ...props }: React.ComponentProps<typeof C>) {
  return <C className={cn("flex h-full w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground", className)} {...props} />;
}
export function CommandInput({ className, ...props }: React.ComponentProps<typeof C.Input>) {
  return (
    <div className="flex h-12 items-center gap-2 border-b px-3">
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <C.Input className={cn("flex h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground", className)} {...props} />
    </div>
  );
}
export function CommandList({ className, ...props }: React.ComponentProps<typeof C.List>) {
  return <C.List className={cn("max-h-[360px] overflow-y-auto p-1", className)} {...props} />;
}
export function CommandEmpty(props: React.ComponentProps<typeof C.Empty>) {
  return <C.Empty className="py-8 text-center text-[13px] text-muted-foreground" {...props} />;
}
export function CommandGroup({ className, ...props }: React.ComponentProps<typeof C.Group>) {
  return (
    <C.Group
      className={cn("overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground", className)}
      {...props}
    />
  );
}
export function CommandItem({ className, ...props }: React.ComponentProps<typeof C.Item>) {
  return (
    <C.Item
      className={cn("flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-[13px] outline-none select-none data-[selected=true]:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground", className)}
      {...props}
    />
  );
}
