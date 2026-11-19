import "server-only";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { connection } from "next/server";
import type { ContactStatus, JobContactRow, JobRow, JobStatus } from "./database.types";
import { likePattern, periodStart, type JobFilters, type Period } from "./filters";

export const PAGE_SIZE = 50;

type SqlRow = Record<string, SQLInputValue>;

// The radar (repo root) owns the file and its schema; the dashboard opens the same file.
const DB_PATH = process.env.RADAR_DB ?? resolve(process.cwd(), "..", "data", "radar.db");

let db: DatabaseSync | undefined;

export class MissingDatabaseError extends Error {}

/** Waits for a request (sync SQLite reads would otherwise be frozen into the build) and opens the file. */
async function openDb(): Promise<DatabaseSync> {
  await connection();
  if (!existsSync(DB_PATH)) throw new MissingDatabaseError(DB_PATH);
  db ??= new DatabaseSync(DB_PATH);
  return db;
}

function parseList(value: SQLInputValue | undefined): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toJob(row: SqlRow): JobRow {
  return {
    ...(row as unknown as JobRow),
    sources: parseList(row.sources),
    requirements: row.requirements == null ? null : parseList(row.requirements),
  };
}

export async function listJobs(filters: JobFilters): Promise<{ jobs: JobRow[]; total: number }> {
  const database = await openDb();
  const where: string[] = [];
  const params: SQLInputValue[] = [];
  const add = (sql: string, ...values: SQLInputValue[]): void => {
    where.push(sql);
    params.push(...values);
  };

  if (filters.status === "abertas") where.push("status in ('new', 'approved', 'pending_me')");
  else if (filters.status !== "todas") add("status = ?", filters.status);
  if (filters.scope !== "todas") add("remote_scope = ?", filters.scope);
  if (filters.language !== "todas") add("language = ?", filters.language);
  if (filters.source !== "todas") add("exists (select 1 from json_each(jobs.sources) where value = ?)", filters.source);
  if (filters.location) add("lower(location) like lower(?)", likePattern(filters.location));
  if (filters.query) add("(lower(title) like lower(?) or lower(company) like lower(?))", likePattern(filters.query), likePattern(filters.query));
  if (filters.minScore > 0) add("score >= ?", filters.minScore);
  const since = periodStart(filters.period);
  if (since) add("first_seen_at >= ?", since);

  const clause = where.length ? `where ${where.join(" and ")}` : "";
  const total = Number((database.prepare(`select count(*) as total from jobs ${clause}`).get(...params) as SqlRow).total);
  const rows = database
    .prepare(`select * from jobs ${clause} order by score is null, score desc, first_seen_at desc limit ? offset ?`)
    .all(...params, PAGE_SIZE, (filters.page - 1) * PAGE_SIZE) as SqlRow[];
  return { jobs: rows.map(toJob), total };
}

export async function getJob(id: string): Promise<{ job: JobRow; contacts: JobContactRow[] } | undefined> {
  const database = await openDb();
  const row = database.prepare("select * from jobs where id = ?").get(id) as SqlRow | undefined;
  if (!row) return undefined;
  const contacts = database.prepare("select * from job_contacts where job_id = ? order by kind, name").all(id) as unknown as JobContactRow[];
  return { job: toJob(row), contacts };
}

export async function setJobStatus(id: string, status: JobStatus): Promise<void> {
  const database = await openDb();
  database
    .prepare("update jobs set status = ?, status_reason = ? where id = ? and status in ('new', 'approved', 'skipped')")
    .run(status, status === "skipped" ? "Descartada no painel" : null, id);
}

export async function setContactStatus(id: string, status: ContactStatus): Promise<void> {
  const database = await openDb();
  const contactedAt = status === "found" || status === "ignored" ? null : new Date().toISOString();
  database.prepare("update job_contacts set status = ?, contacted_at = coalesce(contacted_at, ?) where id = ?").run(status, contactedAt, id);
}

export interface Metrics {
  totals: {
    collected: number;
    above_70: number;
    approved: number;
    pending_me: number;
    failed: number;
  };
  applied_in_period: number;
  by_source: { source: string; collected: number; above_70: number; applied: number; avg_score: number | null }[];
  by_day: { day: string; collected: number; above_70: number; applied: number }[];
  last_runs: { source: string; ok: boolean; inserted: number; error: string | null; created_at: string }[];
  contacts: { found: number; contacted: number; replied: number };
}

/** Days are counted in São Paulo time (UTC-3, no daylight saving since 2019). */
const LOCAL_DAY = "date(%s, '-3 hours')";

export async function getMetrics(period: Period): Promise<Metrics> {
  const database = await openDb();
  const since = periodStart(period) ?? "1970-01-01T00:00:00.000Z";
  const one = (sql: string, ...params: SQLInputValue[]): SqlRow => database.prepare(sql).get(...params) as SqlRow;
  const all = (sql: string, ...params: SQLInputValue[]): SqlRow[] => database.prepare(sql).all(...params) as SqlRow[];

  const totals = one(
    `select count(*) as collected, coalesce(sum(score >= 70), 0) as above_70,
       coalesce(sum(status = 'approved'), 0) as approved, coalesce(sum(status = 'pending_me'), 0) as pending_me,
       coalesce(sum(status = 'failed'), 0) as failed
     from jobs where first_seen_at >= ?`,
    since,
  );
  const applied = all(
    `select ${LOCAL_DAY.replace("%s", "created_at")} as day, count(*) as applied
     from application_events where status = 'applied' and created_at >= ? group by day`,
    since,
  );
  const appliedByDay = new Map(applied.map((row) => [String(row.day), Number(row.applied)]));
  const collectedByDay = all(
    `select ${LOCAL_DAY.replace("%s", "first_seen_at")} as day, count(*) as collected, coalesce(sum(score >= 70), 0) as above_70
     from jobs where first_seen_at >= ? group by day`,
    since,
  );
  const days = new Map<string, { day: string; collected: number; above_70: number; applied: number }>();
  for (const row of collectedByDay) {
    days.set(String(row.day), { day: String(row.day), collected: Number(row.collected), above_70: Number(row.above_70), applied: 0 });
  }
  for (const [day, count] of appliedByDay) {
    days.set(day, { ...(days.get(day) ?? { day, collected: 0, above_70: 0, applied: 0 }), applied: count });
  }

  const contacts = one(
    `select count(*) as found, coalesce(sum(status in ('invited', 'messaged', 'replied')), 0) as contacted,
       coalesce(sum(status = 'replied'), 0) as replied
     from job_contacts where found_at >= ?`,
    since,
  );

  return {
    totals: {
      collected: Number(totals.collected),
      above_70: Number(totals.above_70),
      approved: Number(totals.approved),
      pending_me: Number(totals.pending_me),
      failed: Number(totals.failed),
    },
    applied_in_period: [...appliedByDay.values()].reduce((sum, count) => sum + count, 0),
    by_source: all(
      `select s.value as source, count(*) as collected, coalesce(sum(j.score >= 70), 0) as above_70,
         coalesce(sum(j.status = 'applied'), 0) as applied, round(avg(j.score), 1) as avg_score
       from jobs j, json_each(j.sources) s where j.first_seen_at >= ? group by s.value`,
      since,
    ).map((row) => ({
      source: String(row.source),
      collected: Number(row.collected),
      above_70: Number(row.above_70),
      applied: Number(row.applied),
      avg_score: row.avg_score == null ? null : Number(row.avg_score),
    })),
    by_day: [...days.values()].sort((a, b) => b.day.localeCompare(a.day)),
    last_runs: all(
      `select source, ok, inserted, error, created_at from source_runs r
       where created_at = (select max(created_at) from source_runs where source = r.source) order by source`,
    ).map((row) => ({
      source: String(row.source),
      ok: Number(row.ok) === 1,
      inserted: Number(row.inserted),
      error: row.error == null ? null : String(row.error),
      created_at: String(row.created_at),
    })),
    contacts: { found: Number(contacts.found), contacted: Number(contacts.contacted), replied: Number(contacts.replied) },
  };
}
