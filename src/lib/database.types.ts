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
export type ExpenseCategory =
  | "software" | "hosting" | "domini" | "hardware" | "collaboratori" | "marketing"
  | "trasferte" | "formazione" | "ufficio" | "telefonia" | "tasse" | "banca" | "altro";
export type ExpensePaidWith = "azienda" | "personale";
export type QuoteStatus = "bozza" | "inviato" | "accettato" | "rifiutato";
export type ServiceCategory =
  | "sito" | "ecommerce" | "software" | "gestionale" | "app" | "automazione_ai" | "seo"
  | "grafica" | "hosting" | "assistenza" | "altro";

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
  email_notifications: boolean;
  notification_email: string | null;
  notify_telegram: boolean;
  telegram_chat_id: number | null;
  telegram_username: string | null;
  telegram_link_code: string | null;
  notify_whatsapp: boolean;
  whatsapp_number: string | null;
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
  app_url: string;
  email_from: string;
  telegram_bot_username: string | null;
  telegram_getme_request: number | null;
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
  entity_type: "task" | "project" | "client" | "lead" | "discussion";
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
  emailed_at: string | null;
  delivered_at: string | null;
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
  payment_confirmed_at: string | null;
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

export type ExpenseRow = Timestamps & {
  id: string;
  spent_on: string;
  description: string;
  amount_cents: number;
  category: ExpenseCategory;
  supplier: string | null;
  paid_by: string | null;
  paid_with: ExpensePaidWith;
  method: PaymentMethod;
  reimbursed_on: string | null;
  client_id: string | null;
  project_id: string | null;
  subscription_id: string | null;
  renewal_id: string | null;
  notes: string | null;
  created_by: string | null;
  deleted_at: string | null;
};

export type ExpenseSubscriptionRow = Timestamps & {
  id: string;
  name: string;
  supplier: string | null;
  category: ExpenseCategory;
  amount_cents: number;
  frequency: RenewalFrequency;
  start_date: string;
  end_date: string | null;
  charges_count: number;
  next_charge_date: string;
  paid_by: string | null;
  paid_with: ExpensePaidWith;
  method: PaymentMethod;
  active: boolean;
  notes: string | null;
  created_by: string | null;
  deleted_at: string | null;
};

export type QuoteRow = Timestamps & {
  id: string;
  number: string | null;
  title: string;
  client_id: string | null;
  lead_id: string | null;
  project_id: string | null;
  status: QuoteStatus;
  issue_date: string;
  valid_until: string;
  intro: string | null;
  terms: string | null;
  vat_rate: number;
  discount_cents: number;
  deposit_pct: number;
  owner_id: string | null;
  sent_at: string | null;
  decided_at: string | null;
  refused_reason: string | null;
  created_by: string | null;
  deleted_at: string | null;
};

export type QuoteItemRow = {
  id: string;
  quote_id: string;
  position: number;
  description: string;
  details: string | null;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  frequency: RenewalFrequency | null;
  created_at: string;
};

export type ServiceRow = Timestamps & {
  id: string;
  name: string;
  description: string | null;
  category: ServiceCategory;
  unit: string;
  price_cents: number | null;
  frequency: RenewalFrequency | null;
  active: boolean;
  position: number;
  created_by: string | null;
  deleted_at: string | null;
};

/** Campi generati dal DB → opzionali in inserimento */
export type ChatConversationRow = {
  id: string;
  kind: "diretta" | "canale";
  name: string | null;
  slug: string | null;
  created_by: string | null;
  last_message_at: string | null;
  created_at: string;
};
export type ChatMemberRow = {
  conversation_id: string;
  user_id: string;
  last_read_at: string;
  notified_at: string | null;
  joined_at: string;
};
export type ChatMessageRow = {
  id: string;
  conversation_id: string;
  author_id: string | null;
  body: string;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};
export type ChatOverviewRow = {
  id: string;
  kind: "diretta" | "canale";
  name: string | null;
  other_id: string | null;
  other_name: string | null;
  last_body: string | null;
  last_author: string | null;
  last_at: string;
  last_deleted: boolean | null;
  unread: number;
};

export type DiscussionKind = "punto" | "discussione";
export type DiscussionStatus = "aperto" | "risolto";
export type DiscussionPriority = "bassa" | "normale" | "alta";
export type DiscussionRow = {
  id: string;
  number: number;
  kind: DiscussionKind;
  title: string;
  body: string | null;
  status: DiscussionStatus;
  priority: DiscussionPriority;
  owner_id: string | null;
  due_date: string | null;
  project_id: string | null;
  client_id: string | null;
  resolution: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_by: string;
  replies_count: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TechServiceCategory = "hosting" | "database" | "dominio" | "email" | "ai" | "pagamenti" | "storage" | "analytics" | "monitoraggio" | "repository" | "altro";
export type ProjectTechRow = {
  project_id: string;
  stack: string[];
  patterns: string[];
  repo_url: string | null;
  prod_url: string | null;
  staging_url: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
};
export type ProjectServiceRow = {
  id: string;
  project_id: string;
  provider: string;
  category: TechServiceCategory;
  purpose: string | null;
  dashboard_url: string | null;
  account: string | null;
  plan: string | null;
  owner: "omnira" | "cliente";
  notes: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

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
      project_tech: {
        Row: ProjectTechRow;
        Insert: InsertOf<ProjectTechRow, "project_id">;
        Update: Partial<ProjectTechRow>;
        Relationships: [{ foreignKeyName: "project_tech_updated_by_fkey"; columns: ["updated_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      project_services: {
        Row: ProjectServiceRow;
        Insert: InsertOf<ProjectServiceRow, "project_id" | "provider">;
        Update: Partial<ProjectServiceRow>;
        Relationships: [];
      };
      discussions: {
        Row: DiscussionRow;
        Insert: InsertOf<DiscussionRow, "title">;
        Update: Partial<DiscussionRow>;
        Relationships: [
          { foreignKeyName: "discussions_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "discussions_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "discussions_resolved_by_fkey"; columns: ["resolved_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "discussions_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "discussions_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
        ];
      };
      user_presence: {
        Row: { user_id: string; last_seen_at: string };
        Insert: { user_id: string; last_seen_at?: string };
        Update: { last_seen_at?: string };
        Relationships: [];
      };
      chat_conversations: {
        Row: ChatConversationRow;
        Insert: InsertOf<ChatConversationRow, "kind">;
        Update: Partial<ChatConversationRow>;
        Relationships: [];
      };
      chat_members: {
        Row: ChatMemberRow;
        Insert: InsertOf<ChatMemberRow, "conversation_id" | "user_id">;
        Update: Partial<ChatMemberRow>;
        Relationships: [
          { foreignKeyName: "chat_members_conversation_id_fkey"; columns: ["conversation_id"]; isOneToOne: false; referencedRelation: "chat_conversations"; referencedColumns: ["id"] },
          { foreignKeyName: "chat_members_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      chat_messages: {
        Row: ChatMessageRow;
        Insert: InsertOf<ChatMessageRow, "conversation_id" | "body">;
        Update: Partial<ChatMessageRow>;
        Relationships: [
          { foreignKeyName: "chat_messages_conversation_id_fkey"; columns: ["conversation_id"]; isOneToOne: false; referencedRelation: "chat_conversations"; referencedColumns: ["id"] },
          { foreignKeyName: "chat_messages_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
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
      expenses: {
        Row: ExpenseRow;
        Insert: InsertOf<ExpenseRow, "description" | "amount_cents">;
        Update: Partial<ExpenseRow>;
        Relationships: [
          { foreignKeyName: "expenses_paid_by_fkey"; columns: ["paid_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_subscription_id_fkey"; columns: ["subscription_id"]; isOneToOne: false; referencedRelation: "expense_subscriptions"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_renewal_id_fkey"; columns: ["renewal_id"]; isOneToOne: false; referencedRelation: "renewals"; referencedColumns: ["id"] },
        ];
      };
      expense_subscriptions: {
        Row: ExpenseSubscriptionRow;
        Insert: InsertOf<ExpenseSubscriptionRow, "name" | "amount_cents">;
        Update: Partial<ExpenseSubscriptionRow>;
        Relationships: [
          { foreignKeyName: "expense_subscriptions_paid_by_fkey"; columns: ["paid_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "expense_subscriptions_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      quotes: {
        Row: QuoteRow;
        Insert: InsertOf<QuoteRow, "title">;
        Update: Partial<QuoteRow>;
        Relationships: [
          { foreignKeyName: "quotes_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clients"; referencedColumns: ["id"] },
          { foreignKeyName: "quotes_lead_id_fkey"; columns: ["lead_id"]; isOneToOne: false; referencedRelation: "leads"; referencedColumns: ["id"] },
          { foreignKeyName: "quotes_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "quotes_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      services: {
        Row: ServiceRow;
        Insert: InsertOf<ServiceRow, "name">;
        Update: Partial<ServiceRow>;
        Relationships: [];
      };
      quote_items: {
        Row: QuoteItemRow;
        Insert: InsertOf<QuoteItemRow, "quote_id" | "description">;
        Update: Partial<QuoteItemRow>;
        Relationships: [{ foreignKeyName: "quote_items_quote_id_fkey"; columns: ["quote_id"]; isOneToOne: false; referencedRelation: "quotes"; referencedColumns: ["id"] }];
      };
    };
    Views: {
      project_progress: { Row: ProjectProgressRow; Relationships: [] };
    };
    Functions: {
      chat_open_direct: { Args: { other: string }; Returns: string };
      chat_mark_read: { Args: { conv: string }; Returns: undefined };
      chat_overview: { Args: Record<string, never>; Returns: ChatOverviewRow[] };
      tech_suggestions: { Args: Record<string, never>; Returns: { kind: "stack" | "pattern" | "provider"; value: string; uses: number }[] };
      chat_heartbeat: { Args: Record<string, never>; Returns: undefined };
      chat_unread_total: { Args: Record<string, never>; Returns: number };
      current_app_role: { Args: Record<string, never>; Returns: AppRole };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      has_role: { Args: { roles: AppRole[] }; Returns: boolean };
      accept_quote: {
        Args: { p_id: string; p_create_project?: boolean; p_project_type?: ProjectType; p_create_receivables?: boolean; p_create_renewals?: boolean };
        Returns: string | null;
      };
      send_test_email: { Args: Record<string, never>; Returns: string };
      send_test_telegram: { Args: Record<string, never>; Returns: string };
      telegram_setup: { Args: Record<string, never>; Returns: string };
      telegram_link: { Args: { p_secret: string; p_code: string; p_chat: number; p_username: string | null }; Returns: string };
      notification_channels: { Args: Record<string, never>; Returns: { email_ready: boolean; telegram_ready: boolean; telegram_bot: string | null }[] };
      email_status: {
        Args: Record<string, never>;
        Returns: {
          created_at: string | null;
          to_email: string | null;
          subject: string | null;
          kind: string | null;
          status: string | null;
          http_status: number | null;
          detail: string | null;
          key_configured: boolean;
        }[];
      };
      renew_renewal: { Args: { p_id: string; p_create_receivable?: boolean; p_create_expense?: boolean }; Returns: string };
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
      expense_category: ExpenseCategory;
      expense_paid_with: ExpensePaidWith;
      quote_status: QuoteStatus;
      service_category: ServiceCategory;
    };
    CompositeTypes: Record<never, never>;
  };
};
