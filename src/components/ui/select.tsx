"use client";
import * as React from "react";
import { Select as S } from "radix-ui";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = S.Root;
export const SelectValue = S.Value;

export function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof S.Trigger>) {
  return (
    <S.Trigger
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 data-[placeholder]:text-muted-foreground [&>span]:truncate",
        className,
      )}
      {...props}
    >
      {children}
      <S.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-50" />
      </S.Icon>
    </S.Trigger>
  );
}
export function SelectContent({ className, children, position = "popper", ...props }: React.ComponentProps<typeof S.Content>) {
  return (
    <S.Portal>
      <S.Content
        position={position}
        sideOffset={4}
        className={cn(
          "relative z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg",
          position === "popper" && "w-[var(--radix-select-trigger-width)]",
          className,
        )}
        {...props}
      >
        <S.Viewport className="p-1">{children}</S.Viewport>
      </S.Content>
    </S.Portal>
  );
}
export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof S.Item>) {
  return (
    <S.Item
      className={cn(
        "relative flex w-full cursor-default items-center rounded-md py-1.5 pr-8 pl-2 text-[13px] outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <S.ItemIndicator>
          <CheckIcon className="size-4" />
        </S.ItemIndicator>
      </span>
      <S.ItemText>{children}</S.ItemText>
    </S.Item>
  );
}

export const SelectGroup = S.Group;
export function SelectLabel({ className, ...props }: React.ComponentProps<typeof S.Label>) {
  return <S.Label className={cn("px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase", className)} {...props} />;
}
