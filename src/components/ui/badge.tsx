import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { TONE } from "@/lib/areas";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-transparent bg-muted text-muted-foreground",
        primary: "border-transparent bg-primary/10 text-primary",
        success: "border-transparent bg-success/14 text-[oklch(0.45_0.13_150)] dark:text-success",
        warning: "border-transparent bg-warning text-warning-foreground dark:bg-warning/20",
        danger: "border-transparent bg-destructive/10 text-destructive",
        outline: "text-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

/** Badge di stato: colore + etichetta (+ pallino), mai solo colore. */
export function Badge({
  className,
  tone,
  dot = false,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  const t = tone && tone !== "outline" ? tone : "neutral";
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className={cn("size-1.5 rounded-full", t === "warning" ? "bg-warning-foreground/70" : TONE[t].dot)} aria-hidden />}
      {children}
    </span>
  );
}
