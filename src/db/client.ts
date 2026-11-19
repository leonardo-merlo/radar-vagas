import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "../config.js";
import type { NormalizedJob } from "../core/types.js";
import type { Database, JobContactRow, JobRow, JobStatus } from "./database.types.js";

export type RadarDb = SupabaseClient<Database>;

export function createDb(): RadarDb {
  return createClient<Database>(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

const UPSERT_CHUNK = 200;

export async function upsertJobs(db: RadarDb, jobs: NormalizedJob[]): Promise<{ insertedIds: string[] }> {
  const insertedIds: string[] = [];
  for (let start = 0; start < jobs.length; start += UPSERT_CHUNK) {
    const payload = jobs.slice(start, start + UPSERT_CHUNK).map((job) => ({
      fingerprint: job.fingerprint,
      source: job.source,
      sources: job.sources,
      external_id: job.externalId,
      url: job.url,
      apply_url: job.applyUrl ?? null,
      apply_type: job.applyType,
      title: job.title,
      company: job.company,
      location: job.location ?? null,
      remote_scope: job.remoteScope,
      language: job.language ?? null,
      description: job.description ?? null,
      posted_at: job.postedAt && !Number.isNaN(Date.parse(job.postedAt)) ? job.postedAt : null,
    }));
    const { data, error } = await db.rpc("upsert_jobs", { payload });
    if (error) throw new Error(`upsert_jobs: ${error.message}`);
    for (const row of data ?? []) if (row.inserted) insertedIds.push(row.id);
  }
  return { insertedIds };
}

export async function unscoredJobs(db: RadarDb, limit: number): Promise<JobRow[]> {
  const { data, error } = await db
    .from("jobs")
    .select("*")
    .is("score", null)
    .order("first_seen_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`unscoredJobs: ${error.message}`);
  return data;
}

export async function saveScore(
  db: RadarDb,
  id: string,
  score: { score: number; reason: string; requirements: string[]; language: string | null; skipReason?: string },
): Promise<void> {
  const { error } = await db
    .from("jobs")
    .update({
      score: score.score,
      score_reason: score.reason,
      requirements: score.requirements,
      language: score.language,
      scored_at: new Date().toISOString(),
      ...(score.skipReason ? { status: "skipped" as const, status_reason: score.skipReason } : {}),
    })
    .eq("id", id);
  if (error) throw new Error(`saveScore: ${error.message}`);
}

export async function jobsByIds(db: RadarDb, ids: string[]): Promise<JobRow[]> {
  if (ids.length === 0) return [];
  const rows: JobRow[] = [];
  for (let start = 0; start < ids.length; start += 200) {
    const { data, error } = await db.from("jobs").select("*").in("id", ids.slice(start, start + 200));
    if (error) throw new Error(`jobsByIds: ${error.message}`);
    rows.push(...data);
  }
  return rows;
}

export async function recordSourceRun(
  db: RadarDb,
  run: { runId: string; source: string; ok: boolean; fetched: number; kept: number; inserted: number; error?: string; durationMs: number },
): Promise<void> {
  const { error } = await db.from("source_runs").insert({
    run_id: run.runId,
    source: run.source,
    ok: run.ok,
    fetched: run.fetched,
    kept: run.kept,
    inserted: run.inserted,
    error: run.error ?? null,
    duration_ms: run.durationMs,
  });
  if (error) throw new Error(`recordSourceRun: ${error.message}`);
}

/** Queue for the apply skill: not yet handled, approved by hand or above the cutoff. */
export async function applyQueue(db: RadarDb, cutoff: number, limit: number): Promise<JobRow[]> {
  const { data, error } = await db
    .from("jobs")
    .select("*")
    .or(`status.eq.approved,and(status.eq.new,score.gte.${cutoff})`)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`applyQueue: ${error.message}`);
  return data;
}

export async function appliedTodayByPlatform(db: RadarDb): Promise<Record<string, number>> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data, error } = await db
    .from("application_events")
    .select("platform")
    .eq("status", "applied")
    .gte("created_at", startOfDay.toISOString());
  if (error) throw new Error(`appliedTodayByPlatform: ${error.message}`);
  const counts: Record<string, number> = {};
  for (const row of data) counts[row.platform] = (counts[row.platform] ?? 0) + 1;
  return counts;
}

export async function markJob(
  db: RadarDb,
  input: { id: string; status: JobStatus; platform: string; reason?: string; cvUsed?: string },
): Promise<JobRow> {
  const { data, error } = await db
    .from("jobs")
    .update({
      status: input.status,
      status_reason: input.reason ?? null,
      applied_at: input.status === "applied" ? new Date().toISOString() : null,
      cv_used: input.cvUsed ?? null,
    })
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) throw new Error(`markJob: ${error.message}`);
  const event = await db
    .from("application_events")
    .insert({ job_id: input.id, platform: input.platform, status: input.status, reason: input.reason ?? null });
  if (event.error) throw new Error(`markJob event: ${event.error.message}`);
  return data;
}

/** Approved jobs whose company was not searched for contacts yet. One entry per company. */
export async function jobsNeedingContacts(db: RadarDb, limit: number): Promise<JobRow[]> {
  const { data, error } = await db
    .from("jobs")
    .select("*")
    .eq("status", "approved")
    .is("contacts_searched_at", null)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit * 3);
  if (error) throw new Error(`jobsNeedingContacts: ${error.message}`);
  const byCompany = new Map<string, JobRow>();
  for (const job of data) if (!byCompany.has(job.company.toLowerCase())) byCompany.set(job.company.toLowerCase(), job);
  return [...byCompany.values()].slice(0, limit);
}

export async function contactsSearchedToday(db: RadarDb): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error } = await db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .gte("contacts_searched_at", startOfDay.toISOString());
  if (error) throw new Error(`contactsSearchedToday: ${error.message}`);
  return count ?? 0;
}

export async function saveContacts(db: RadarDb, job: JobRow, contacts: NewContact[]): Promise<number> {
  if (contacts.length > 0) {
    const rows = contacts.map((contact) => ({ ...contact, job_id: job.id, company: job.company }));
    const { error } = await db.from("job_contacts").upsert(rows, { onConflict: "job_id,linkedin_url" });
    if (error) throw new Error(`saveContacts: ${error.message}`);
  }
  // Every open job at the same company counts as searched, so the skill doesn't repeat the search.
  const { error } = await db
    .from("jobs")
    .update({ contacts_searched_at: new Date().toISOString() })
    .eq("company", job.company)
    .is("contacts_searched_at", null);
  if (error) throw new Error(`saveContacts mark: ${error.message}`);
  return contacts.length;
}

export interface NewContact {
  name: string;
  title: string | null;
  kind: JobContactRow["kind"];
  linkedin_url: string;
  why: string | null;
  message_draft: string | null;
}

export async function jobById(db: RadarDb, id: string): Promise<JobRow> {
  const { data, error } = await db.from("jobs").select("*").eq("id", id).single();
  if (error) throw new Error(`jobById: ${error.message}`);
  return data;
}
