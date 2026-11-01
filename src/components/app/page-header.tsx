import type { LucideIcon } from "lucide-react";
import { HeaderMenuButton, HeaderTools } from "@/components/layout/header-tools";
import { AREA, type Area } from "@/lib/areas";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
  children,
  area = "system",
  icon: Icon,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  area?: Area;
  icon?: LucideIcon;
  /** Riga sopra il titolo: di solito il nome dell'area o un codice */
  eyebrow?: React.ReactNode;
}) {
  const a = AREA[area];
  return (
    <div className={cn("relative flex flex-col gap-4 border-b px-4 pt-5 pb-5 sm:px-6", a.headerBg, className)}>
      <span className={cn("absolute inset-x-0 top-0 h-[3px]", a.stripe)} aria-hidden />
      <div className="flex flex-wrap items-start justify-between gap-3 lg:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <span className="-ml-1.5 lg:hidden">
            <HeaderMenuButton />
          </span>
          {Icon && (
            <span className={cn("mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm", a.tile)}>
              <Icon className="size-[22px]" strokeWidth={1.9} />
            </span>
          )}
          <div className="min-w-0">
            <p className={cn("text-[11px] font-semibold tracking-wider uppercase", a.text)}>{eyebrow ?? a.label}</p>
            <h1 className="truncate text-2xl leading-tight font-semibold">{title}</h1>
            {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {actions && <div className="flex items-center gap-2">{actions}</div>}
          <HeaderTools />
        </div>
      </div>
      {children}
    </div>
  );
}

export function PageBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex-1 px-4 py-6 sm:px-6", className)} {...props} />;
}

/** Titolo di sezione dentro una pagina, con icona colorata dell'area */
export function SectionTitle({
  icon: Icon,
  area = "system",
  children,
  action,
}: {
  icon?: LucideIcon;
  area?: Area;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const a = AREA[area];
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        {Icon && (
          <span className={cn("flex size-7 items-center justify-center rounded-lg", a.soft, a.text)}>
            <Icon className="size-4" strokeWidth={2} />
          </span>
        )}
        {children}
      </h2>
      {action}
    </div>
  );
}
