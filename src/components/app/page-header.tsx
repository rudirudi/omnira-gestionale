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
    <div className={cn("relative flex flex-col gap-4 border-b px-4 pt-3 pb-4 sm:px-6 lg:pt-5 lg:pb-5", a.headerBg, className)}>
      <span className={cn("absolute inset-x-0 top-0 h-[3px]", a.stripe)} aria-hidden />
      {/* Telefono: menu e strumenti in alto, poi titolo, poi azioni a tutta larghezza.
          Computer: titolo a sinistra, azioni e strumenti a destra sulla stessa riga. */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-3 lg:flex-nowrap">
        <span className="order-1 -ml-1.5 lg:hidden">
          <HeaderMenuButton />
        </span>
        <div className="order-3 flex min-w-0 basis-full items-start gap-3 lg:order-2 lg:flex-1 lg:basis-auto lg:gap-3.5">
          {Icon && (
            <span className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm lg:size-11", a.tile)}>
              <Icon className="size-5 lg:size-[22px]" strokeWidth={1.9} />
            </span>
          )}
          <div className="min-w-0">
            <p className={cn("text-[11px] font-semibold tracking-wider uppercase", a.text)}>{eyebrow ?? a.label}</p>
            <h1 className="line-clamp-2 text-xl leading-tight font-semibold break-words lg:truncate lg:text-2xl">{title}</h1>
            {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="order-4 flex basis-full flex-wrap items-center gap-2 lg:order-3 lg:basis-auto lg:flex-nowrap">{actions}</div>}
        <div className="order-2 ml-auto shrink-0 lg:order-4 lg:ml-0">
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
