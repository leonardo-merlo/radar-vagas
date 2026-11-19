// Mirrors supabase/migrations/0001_init.sql. Regenerate with:
// npx supabase gen types typescript --project-id <id> > src/db/database.types.ts

export type ApplyType = "easy_apply" | "form" | "email" | "external" | "unknown";
export type RemoteScope = "worldwide" | "latam" | "brazil" | "europe" | "unknown";
export type JobStatus = "new" | "approved" | "skipped" | "applied" | "pending_me" | "failed";

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
      application_events: {
        Row: ApplicationEventRow;
        Insert: Insertable<ApplicationEventRow, "job_id" | "platform" | "status">;
        Update: Partial<ApplicationEventRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      upsert_jobs: {
        Args: { payload: unknown };
        Returns: { id: string; inserted: boolean }[];
      };
    };
    Enums: {
      apply_type: ApplyType;
      remote_scope: RemoteScope;
      job_status: JobStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
