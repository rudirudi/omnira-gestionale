// Tipi del database. Scritti a mano sulla migrazione iniziale:
// quando il progetto Supabase è collegato, rigenerarli con
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "admin" | "project_manager" | "team" | "amministrazione" | "commerciale";
export type ClientStatus = "prospect" | "attivo" | "inattivo";
export type LeadStage = "nuovo" | "call" | "analisi" | "preventivo" | "vinto" | "perso";
export type LeadSource = "sito" | "form" | "chatbot" | "whatsapp" | "referral" | "social" | "evento" | "altro";
export type ActivityType = "nota" | "chiamata" | "email" | "riunione" | "promemoria";
export type ProjectType = "sito" | "ecommerce" | "software" | "app" | "gestionale" | "automazione_ai" | "seo" | "altro";
export type ProjectStatus = "pianificato" | "attivo" | "in_pausa" | "completato" | "annullato";
export type BillingType = "corpo" | "ore" | "canone";
export type PhaseStatus = "da_iniziare" | "in_corso" | "completata";
export type TaskStatus = "da_fare" | "in_corso" | "in_review" | "test" | "fatto";
export type TaskPriority = "bassa" | "media" | "alta" | "urgente";
export type PaymentMethod = "bonifico" | "carta" | "contanti" | "paypal" | "stripe" | "riba" | "altro";
export type RenewalType = "dominio" | "hosting" | "server" | "ssl" | "email" | "licenza" | "saas" | "manutenzione" | "altro";
export type RenewalFrequency = "mensile" | "trimestrale" | "semestrale" | "annuale" | "biennale";

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

export type ProjectRow = Timestamps & {
  id: string;
  code: string | null;
  name: string;
  client_id: string | null;
  type: ProjectType;
  status: ProjectStatus;
  billing_type: BillingType;
  budget_cents: number | null;
  budget_hours: number | null;
  start_date: string | null;
  due_date: string | null;
  manager_id: string | null;
  description: string | null;
  lead_id: string | null;
  created_by: string | null;
  completed_at: string | null;
  deleted_at: string | null;
};

export type ProjectMemberRow = { project_id: string; user_id: string; added_at: string };

export type ProjectPhaseRow = {
  id: string;
  project_id: string;
  name: string;
  position: number;
  status: PhaseStatus;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
};

export type MilestoneRow = { id: string; project_id: string; title: string; due_date: string; done_at: string | null; created_at: string };

export type TaskRow = Timestamps & {
  id: string;
  project_id: string;
  phase_id: string | null;
  parent_id: string | null;
  number: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  estimate_hours: number | null;
  position: number;
  created_by: string | null;
  completed_at: string | null;
  deleted_at: string | null;
};

export type TaskAssigneeRow = { task_id: string; user_id: string; assigned_at: string; assigned_by: string | null };

export type CommentRow = {
  id: string;
  entity_type: "task" | "project" | "client" | "lead";
  entity_id: string;
  body: string;
  mentions: string[];
  author_id: string;
  created_at: string;
  edited_at: string | null;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  actor_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type ProjectProgressRow = {
  project_id: string | null;
  total_tasks: number | null;
  done_tasks: number | null;
  overdue_tasks: number | null;
  estimated_hours: number | null;
};

export type RenewalRow = Timestamps & {
  id: string;
  client_id: string | null;
  project_id: string | null;
  type: RenewalType;
  name: string;
  provider: string | null;
  frequency: RenewalFrequency;
  next_due_date: string;
  cost_cents: number | null;
  price_cents: number | null;
  auto_renew: boolean;
  notify_days_before: number;
  notified_for: string | null;
  notified_expired_for: string | null;
  active: boolean;
  notes: string | null;
  created_by: string | null;
  deleted_at: string | null;
};

export type ReceivableRow = Timestamps & {
  id: string;
  client_id: string;
  project_id: string | null;
  renewal_id: string | null;
  description: string;
  amount_cents: number;
  due_date: string | null;
  notes: string | null;
  created_by: string | null;
  deleted_at: string | null;
};

export type PaymentRow = {
  id: string;
  receivable_id: string;
  amount_cents: number;
  paid_on: string;
  method: PaymentMethod;
  note: string | null;
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
      projects: {
        Row: ProjectRow;
        Insert: InsertOf<ProjectRow, "name">;
        Update: Partial<ProjectRow>;
        Relationships: [
          { foreignKeyName: "projects_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "projects_manager_id_fkey"; columns: ["manager_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "projects_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "projects_lead_id_fkey"; columns: ["lead_id"]; isOneToOne: false; referencedRelation: "leads"; referencedColumns: ["id"] },
        ];
      };
      project_members: {
        Row: ProjectMemberRow;
        Insert: InsertOf<ProjectMemberRow, "project_id" | "user_id">;
        Update: Partial<ProjectMemberRow>;
        Relationships: [
          { foreignKeyName: "project_members_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "project_members_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      project_phases: {
        Row: ProjectPhaseRow;
        Insert: InsertOf<ProjectPhaseRow, "project_id" | "name">;
        Update: Partial<ProjectPhaseRow>;
        Relationships: [{ foreignKeyName: "project_phases_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] }];
      };
      milestones: {
        Row: MilestoneRow;
        Insert: InsertOf<MilestoneRow, "project_id" | "title" | "due_date">;
        Update: Partial<MilestoneRow>;
        Relationships: [{ foreignKeyName: "milestones_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] }];
      };
      tasks: {
        Row: TaskRow;
        Insert: InsertOf<TaskRow, "project_id" | "title">;
        Update: Partial<TaskRow>;
        Relationships: [
          { foreignKeyName: "tasks_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "tasks_phase_id_fkey"; columns: ["phase_id"]; isOneToOne: false; referencedRelation: "project_phases"; referencedColumns: ["id"] },
          { foreignKeyName: "tasks_parent_id_fkey"; columns: ["parent_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
          { foreignKeyName: "tasks_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      task_assignees: {
        Row: TaskAssigneeRow;
        Insert: InsertOf<TaskAssigneeRow, "task_id" | "user_id">;
        Update: Partial<TaskAssigneeRow>;
        Relationships: [
          { foreignKeyName: "task_assignees_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
          { foreignKeyName: "task_assignees_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      comments: {
        Row: CommentRow;
        Insert: InsertOf<CommentRow, "entity_type" | "entity_id" | "body">;
        Update: Partial<CommentRow>;
        Relationships: [{ foreignKeyName: "comments_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      notifications: {
        Row: NotificationRow;
        Insert: InsertOf<NotificationRow, "user_id" | "type" | "title">;
        Update: Partial<NotificationRow>;
        Relationships: [
          { foreignKeyName: "notifications_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "notifications_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      renewals: {
        Row: RenewalRow;
        Insert: InsertOf<RenewalRow, "name" | "next_due_date">;
        Update: Partial<RenewalRow>;
        Relationships: [
          { foreignKeyName: "renewals_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "renewals_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
        ];
      };
      receivables: {
        Row: ReceivableRow;
        Insert: InsertOf<ReceivableRow, "client_id" | "description" | "amount_cents">;
        Update: Partial<ReceivableRow>;
        Relationships: [
          { foreignKeyName: "receivables_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "receivables_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "receivables_renewal_id_fkey"; columns: ["renewal_id"]; isOneToOne: false; referencedRelation: "renewals"; referencedColumns: ["id"] },
        ];
      };
      payments: {
        Row: PaymentRow;
        Insert: InsertOf<PaymentRow, "receivable_id" | "amount_cents">;
        Update: Partial<PaymentRow>;
        Relationships: [{ foreignKeyName: "payments_receivable_id_fkey"; columns: ["receivable_id"]; isOneToOne: false; referencedRelation: "receivables"; referencedColumns: ["id"] }];
      };
    };
    Views: {
      project_progress: { Row: ProjectProgressRow; Relationships: [] };
    };
    Functions: {
      current_app_role: { Args: Record<string, never>; Returns: AppRole };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      has_role: { Args: { roles: AppRole[] }; Returns: boolean };
      renew_renewal: { Args: { p_id: string; p_create_receivable?: boolean }; Returns: string };
    };
    Enums: {
      app_role: AppRole;
      client_status: ClientStatus;
      lead_stage: LeadStage;
      lead_source: LeadSource;
      activity_type: ActivityType;
      project_type: ProjectType;
      project_status: ProjectStatus;
      billing_type: BillingType;
      phase_status: PhaseStatus;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      payment_method: PaymentMethod;
      renewal_type: RenewalType;
      renewal_frequency: RenewalFrequency;
    };
    CompositeTypes: Record<never, never>;
  };
};
