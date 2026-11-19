import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, JobContactRow, JobRow } from "./database.types";
import { likePattern, periodStart, type JobFilters, type Period } from "./filters";

type Db = SupabaseClient<Database>;

export const PAGE_SIZE = 50;

export type JobListItem = Pick<
  JobRow,
  "id" | "title" | "company" | "location" | "source" | "sources" | "remote_scope" | "language" | "apply_type" | "score" | "score_reason" | "status" | "first_seen_at" | "url"
>;

const LIST_COLUMNS =
  "id,title,company,location,source,sources,remote_scope,language,apply_type,score,score_reason,status,first_seen_at,url";

export async function listJobs(db: Db, filters: JobFilters): Promise<{ jobs: JobListItem[]; total: number }> {
  let query = db.from("jobs").select(LIST_COLUMNS, { count: "exact" });

  if (filters.status === "abertas") query = query.in("status", ["new", "approved", "pending_me"]);
  else if (filters.status !== "todas") query = query.eq("status", filters.status);
  if (filters.scope !== "todas") query = query.eq("remote_scope", filters.scope);
  if (filters.language !== "todas") query = query.eq("language", filters.language);
  if (filters.source !== "todas") query = query.contains("sources", [filters.source]);
  if (filters.location) query = query.ilike("location", likePattern(filters.location));
  if (filters.query) {
    const pattern = likePattern(filters.query);
    query = query.or(`title.ilike.${pattern},company.ilike.${pattern}`);
  }
  if (filters.minScore > 0) query = query.gte("score", filters.minScore);
  const since = periodStart(filters.period);
  if (since) query = query.gte("first_seen_at", since);

  const from = (filters.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("score", { ascending: false, nullsFirst: false })
    .order("first_seen_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`listJobs: ${error.message}`);
  return { jobs: (data ?? []) as JobListItem[], total: count ?? 0 };
}

export async function getJob(db: Db, id: string): Promise<{ job: JobRow; contacts: JobContactRow[] } | undefined> {
  const [jobResult, contactsResult] = await Promise.all([
    db.from("jobs").select("*").eq("id", id).maybeSingle(),
    db.from("job_contacts").select("*").eq("job_id", id).order("kind"),
  ]);
  if (jobResult.error) throw new Error(`getJob: ${jobResult.error.message}`);
  if (contactsResult.error) throw new Error(`getJob contacts: ${contactsResult.error.message}`);
  if (!jobResult.data) return undefined;
  return { job: jobResult.data, contacts: contactsResult.data ?? [] };
}

export interface Metrics {
  totals: {
    collected: number;
    scored: number;
    above_70: number;
    approved: number;
    applied: number;
    pending_me: number;
    failed: number;
    skipped: number;
    avg_score: number | null;
  };
  applied_in_period: number;
  by_source: { source: string; collected: number; above_70: number; applied: number; avg_score: number | null }[];
  by_day: { day: string; collected: number; above_70: number }[];
  applied_by_day: { day: string; applied: number }[];
  last_runs: { source: string; ok: boolean; fetched: number; kept: number; inserted: number; error: string | null; created_at: string }[];
  contacts: { found: number; contacted: number; replied: number };
}

export async function getMetrics(db: Db, period: Period): Promise<Metrics> {
  const since = periodStart(period) ?? "1970-01-01T00:00:00Z";
  const { data, error } = await db.rpc("dashboard_metrics", { since });
  if (error) throw new Error(`getMetrics: ${error.message}`);
  return data as Metrics;
}
