// Mirrors supabase/migrations/0001_init.sql. Regenerate with:
// npx supabase gen types typescript --project-id <id> > src/db/database.types.ts

export type ApplyType = "easy_apply" | "form" | "email" | "external" | "unknown";
export type RemoteScope = "worldwide" | "latam" | "brazil" | "europe" | "unknown";
export type JobStatus = "new" | "approved" | "skipped" | "applied" | "pending_me" | "failed";
export type ContactKind = "recruiter" | "tech_recruiter" | "talent_acquisition" | "hiring_manager" | "team_member" | "other";
export type ContactStatus = "found" | "invited" | "messaged" | "replied" | "ignored";

export type JobRow = {
  id: string;
  fingerprint: string;
  source: string;
  sources: string[];
  external_id: string | null;
  url: string;
  apply_url: string | null;
  apply_type: ApplyType;
  title: string;
  company: string;
  location: string | null;
  remote_scope: RemoteScope;
  language: string | null;
  description: string | null;
  requirements: string[] | null;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  score: number | null;
  score_reason: string | null;
  scored_at: string | null;
  status: JobStatus;
  status_reason: string | null;
  applied_at: string | null;
  cv_used: string | null;
  contacts_searched_at: string | null;
}

export type SourceRunRow = {
  id: number;
  run_id: string;
  source: string;
  ok: boolean;
  fetched: number;
  kept: number;
  inserted: number;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

export type ApplicationEventRow = {
  id: number;
  job_id: string;
  platform: string;
  status: JobStatus;
  reason: string | null;
  created_at: string;
}

export type JobContactRow = {
  id: string;
  job_id: string;
  company: string;
  name: string;
  title: string | null;
  kind: ContactKind;
  linkedin_url: string;
  why: string | null;
  message_draft: string | null;
  status: ContactStatus;
  found_at: string;
  contacted_at: string | null;
}

type Insertable<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>;

export type Database = {
  public: {
    Tables: {
      jobs: {
        Row: JobRow;
        Insert: Insertable<JobRow, "fingerprint" | "source" | "url" | "title" | "company">;
        Update: Partial<JobRow>;
        Relationships: [];
      };
      source_runs: {
        Row: SourceRunRow;
        Insert: Insertable<SourceRunRow, "run_id" | "source" | "ok">;
        Update: Partial<SourceRunRow>;
        Relationships: [];
      };
      job_contacts: {
        Row: JobContactRow;
        Insert: Insertable<JobContactRow, "job_id" | "company" | "name" | "linkedin_url">;
        Update: Partial<JobContactRow>;
        Relationships: [];
      };
      dashboard_users: {
        Row: { email: string };
        Insert: { email: string };
        Update: { email?: string };
        Relationships: [];
      };
      application_events: {
        Row: ApplicationEventRow;
        Insert: Insertable<ApplicationEventRow, "job_id" | "platform" | "status">;
        Update: Partial<ApplicationEventRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      dashboard_metrics: {
        Args: { since: string };
        Returns: unknown;
      };
      is_dashboard_user: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      upsert_jobs: {
        Args: { payload: unknown };
        Returns: { id: string; inserted: boolean }[];
      };
    };
    Enums: {
      apply_type: ApplyType;
      remote_scope: RemoteScope;
      job_status: JobStatus;
      contact_kind: ContactKind;
      contact_status: ContactStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
