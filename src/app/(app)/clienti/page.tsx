import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import type { ClientStatus } from "@/lib/database.types";
import { CLIENT_STATUS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { cn, formatDate } from "@/lib/utils";
import { ClientsFilters } from "@/modules/clienti/components/clients-filters";
import { NewClientDialog } from "@/modules/clienti/components/new-client-dialog";
import { listClients, listTeam } from "@/modules/clienti/queries";

export const metadata = { title: "Clienti" };

export default async function ClientiPage({ searchParams }: PageProps<"/clienti">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const stato = typeof sp.stato === "string" && sp.stato in CLIENT_STATUS ? (sp.stato as ClientStatus) : undefined;

  const [user, clients, team] = await Promise.all([getCurrentUser(), listClients({ q, status: stato }), listTeam()]);
  const filtered = Boolean(q || stato);

  return (
    <>
      <PageHeader
        title="Clienti"
        area="sales"
        icon={Users}
        description={`${clients.length} ${clients.length === 1 ? "cliente" : "clienti"}${filtered ? " trovati" : ""}`}
        actions={can.editClients(user.role) && <NewClientDialog team={team} />}
      >
        <ClientsFilters />
      </PageHeader>
      <PageBody>
        {clients.length === 0 ? (
          <EmptyState
            area="sales"
            icon={Building2}
            title={filtered ? "Nessun cliente trovato" : "Nessun cliente"}
            description={filtered ? "Prova a cambiare ricerca o filtro." : "Aggiungi il primo cliente o importalo da un lead vinto."}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[36%]">Cliente</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Città</TableHead>
                  <TableHead className="hidden md:table-cell">P.IVA</TableHead>
                  <TableHead className="hidden lg:table-cell">Responsabile</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">Aggiornato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id} className="relative">
                    <TableCell>
                      <Link href={`/clienti/${c.id}`} className="flex items-center gap-2.5 font-medium after:absolute after:inset-0 hover:text-primary">
                        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold", c.status === "attivo" ? "bg-sales text-on-warning" : c.status === "prospect" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{c.name}</span>
                          {c.sector && <span className="block truncate text-xs font-normal text-muted-foreground">{c.sector}</span>}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge dot tone={CLIENT_STATUS[c.status].tone}>{CLIENT_STATUS[c.status].label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.city ?? "—"}
                      {c.province ? ` (${c.province})` : ""}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{c.vat_number ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {c.owner ? (
                        <span className="flex items-center gap-2">
                          <Avatar name={c.owner.full_name} className="size-6 text-[10px]" />
                          {c.owner.full_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground tabular xl:table-cell">{formatDate(c.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PageBody>
    </>
  );
}
