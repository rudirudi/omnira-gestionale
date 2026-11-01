import Link from "next/link";

/** Impaginazione comune per accesso, registrazione e nuova password */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col justify-between p-6 sm:p-10">
        <Link href="/login" className="flex items-center gap-2.5">
          <span className="relative flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            O
            <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-warning ring-2 ring-background" aria-hidden />
          </span>
          <span className="text-sm font-semibold">Omnira Gestionale</span>
        </Link>
        <div className="mx-auto w-full max-w-sm py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">{subtitle}</p>
          {children}
        </div>
        <p className="text-xs text-muted-foreground">Gestionale interno di Omnira Soft.</p>
      </div>
      <div className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:block">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -left-16 size-64 rounded-full bg-white/5" />
        <div className="relative flex h-full flex-col justify-end gap-6 p-12">
          <div className="flex gap-2" aria-hidden>
            <span className="h-1.5 w-12 rounded-full bg-white" />
            <span className="h-1.5 w-6 rounded-full bg-destructive" />
            <span className="h-1.5 w-6 rounded-full bg-success" />
            <span className="h-1.5 w-6 rounded-full bg-warning" />
          </div>
          <p className="max-w-md text-3xl leading-tight font-semibold tracking-tight">
            Clienti, progetti, task e pagamenti. Un solo posto, per tutto il team.
          </p>
          <p className="max-w-md text-[13px] text-sidebar-muted">Terni · Longobucco · da remoto</p>
        </div>
      </div>
    </div>
  );
}
