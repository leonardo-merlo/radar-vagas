// Row shapes of db/schema.sql after mapping (JSON columns parsed, 0/1 as boolean).

export type ApplyType = "easy_apply" | "form" | "email" | "external" | "unknown";
export type RemoteScope = "worldwide" | "latam" | "brazil" | "europe" | "unknown";
export type Seniority = "junior" | "pleno" | "senior" | "nao_definido";
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
  seniority: Seniority;
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
