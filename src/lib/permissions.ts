import type { AppRole } from "@/lib/database.types";

// Rispecchia le policy RLS del database: la UI nasconde, il DB protegge.
export const can = {
  editClients: (r: AppRole) => ["admin", "project_manager", "commerciale", "amministrazione"].includes(r),
  editLeads: (r: AppRole) => ["admin", "project_manager", "commerciale"].includes(r),
  deleteRecords: (r: AppRole) => r === "admin",
  editCompanySettings: (r: AppRole) => r === "admin" || r === "amministrazione",
  manageTeam: (r: AppRole) => r === "admin",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Amministratore",
  project_manager: "Project manager",
  team: "Team (sviluppo/design)",
  amministrazione: "Amministrazione",
  commerciale: "Commerciale",
};
