// Tipi del database. Scritti a mano sulla migrazione iniziale:
// quando il progetto Supabase è collegato, rigenerarli con
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "admin" | "project_manager" | "team" | "amministrazione" | "commerciale";
export type ClientStatus = "prospect" | "attivo" | "inattivo";
export type LeadStage = "nuovo" | "call" | "analisi" | "preventivo" | "vinto" | "perso";
export type LeadSource = "sito" | "form" | "chatbot" | "whatsapp" | "referral" | "social" | "evento" | "altro";
export type ActivityType = "nota" | "chiamata" | "email" | "riunione" | "promemoria";

type Timestamps = { created_at: string; updated_at: string };

export type SiteRow = { id: string; name: string; address: string | null; created_at: string };

export type ProfileRow = Timestamps & {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  site_id: string | null;
  job_title: string | null;
  hourly_cost_cents: number | null;
  active: boolean;
};

export type CompanySettingsRow = {
  id: number;
  legal_name: string;
  vat_number: string | null;
  tax_code: string | null;
  sdi_code: string | null;
  pec: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  iban: string | null;
  invoice_prefix: string;
  default_vat_rate: number;
  updated_at: string;
};

export type AuditLogRow = {
  id: number;
  table_name: string;
  record_id: string | null;
  action: "insert" | "update" | "delete";
  actor_id: string | null;
  changes: Json | null;
  created_at: string;
};

export type ClientRow = Timestamps & {
  id: string;
  name: string;
  legal_name: string | null;
  vat_number: string | null;
  tax_code: string | null;
  sdi_code: string | null;
  pec: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  zip: string | null;
  country: string;
  sector: string | null;
  status: ClientStatus;
  owner_id: string | null;
  notes: string | null;
  created_by: string | null;
  deleted_at: string | null;
};

export type ContactRow = Timestamps & {
  id: string;
  client_id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
};

export type LeadRow = Timestamps & {
  id: string;
  title: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  stage: LeadStage;
  service_interest: string | null;
  estimated_value_cents: number | null;
  expected_close_date: string | null;
  position: number;
  lost_reason: string | null;
  owner_id: string | null;
  client_id: string | null;
  notes: string | null;
  created_by: string | null;
  closed_at: string | null;
  deleted_at: string | null;
};

export type ActivityRow = {
  id: string;
  type: ActivityType;
  subject: string;
  body: string | null;
  due_at: string | null;
  done_at: string | null;
  client_id: string | null;
  lead_id: string | null;
  created_by: string | null;
  created_at: string;
};

/** Campi generati dal DB → opzionali in inserimento */
type InsertOf<R, Required extends keyof R> = Pick<R, Required> & Partial<Omit<R, Required>>;

export type Database = {
  public: {
    Tables: {
      sites: {
        Row: SiteRow;
        Insert: InsertOf<SiteRow, "name">;
        Update: Partial<SiteRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: InsertOf<ProfileRow, "id" | "email">;
        Update: Partial<ProfileRow>;
        Relationships: [
          { foreignKeyName: "profiles_site_id_fkey"; columns: ["site_id"]; isOneToOne: false; referencedRelation: "sites"; referencedColumns: ["id"] },
        ];
      };
      company_settings: {
        Row: CompanySettingsRow;
        Insert: Partial<CompanySettingsRow>;
        Update: Partial<CompanySettingsRow>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: InsertOf<AuditLogRow, "table_name" | "action">;
        Update: Partial<AuditLogRow>;
        Relationships: [];
      };
      clients: {
        Row: ClientRow;
        Insert: InsertOf<ClientRow, "name">;
        Update: Partial<ClientRow>;
        Relationships: [
          { foreignKeyName: "clients_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "clients_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      contacts: {
        Row: ContactRow;
        Insert: InsertOf<ContactRow, "client_id" | "first_name">;
        Update: Partial<ContactRow>;
        Relationships: [
          { foreignKeyName: "contacts_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
        ];
      };
      leads: {
        Row: LeadRow;
        Insert: InsertOf<LeadRow, "title">;
        Update: Partial<LeadRow>;
        Relationships: [
          { foreignKeyName: "leads_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "leads_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "leads_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      activities: {
        Row: ActivityRow;
        Insert: InsertOf<ActivityRow, "subject">;
        Update: Partial<ActivityRow>;
        Relationships: [
          { foreignKeyName: "activities_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "activities_lead_id_fkey"; columns: ["lead_id"]; isOneToOne: false; referencedRelation: "leads"; referencedColumns: ["id"] },
          { foreignKeyName: "activities_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      current_app_role: { Args: Record<string, never>; Returns: AppRole };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      has_role: { Args: { roles: AppRole[] }; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
      client_status: ClientStatus;
      lead_stage: LeadStage;
      lead_source: LeadSource;
      activity_type: ActivityType;
    };
    CompositeTypes: Record<never, never>;
  };
};
