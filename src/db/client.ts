import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { fileURLToPath } from "node:url";
import type { NormalizedJob } from "../core/types.js";
import type { JobContactRow, JobRow, JobStatus } from "./database.types.js";

export type RadarDb = DatabaseSync;

const DEFAULT_PATH = fileURLToPath(new URL("../../data/radar.db", import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL("../../db/schema.sql", import.meta.url));

/** Opens (and creates on first use) the local database. Pass ":memory:" in tests. */
export function createDb(path = process.env.RADAR_DB ?? DEFAULT_PATH): RadarDb {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  return db;
}

type SqlRow = Record<string, SQLInputValue>;

function parseList(value: SQLInputValue): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function toJobRow(row: SqlRow): JobRow {
  return {
    ...(row as unknown as JobRow),
    sources: parseList(row.sources ?? null),
    requirements: row.requirements == null ? null : parseList(row.requirements),
  };
}

function now(): string {
  return new Date().toISOString();
}

function startOfLocalDay(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function transaction<T>(db: RadarDb, work: () => T): T {
  db.exec("begin");
  try {
    const result = work();
    db.exec("commit");
    return result;
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}

/** Inserts new jobs; for known ones only merges the sources and refreshes last_seen_at. */
export function upsertJobs(db: RadarDb, jobs: NormalizedJob[]): { insertedIds: string[] } {
  const find = db.prepare("select id, sources, description, apply_type from jobs where fingerprint = ?");
  const insert = db.prepare(`insert into jobs (
      id, fingerprint, source, sources, external_id, url, apply_url, apply_type, title, company,
      location, remote_scope, language, description, posted_at, first_seen_at, last_seen_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const update = db.prepare(
    "update jobs set last_seen_at = ?, sources = ?, description = coalesce(description, ?), apply_type = ? where id = ?",
  );

  return transaction(db, () => {
    const insertedIds: string[] = [];
    const timestamp = now();
    for (const job of jobs) {
      const existing = find.get(job.fingerprint) as SqlRow | undefined;
      if (existing) {
        const sources = [...new Set([...parseList(existing.sources ?? null), ...job.sources])];
        const applyType = existing.apply_type === "unknown" ? job.applyType : String(existing.apply_type);
        update.run(timestamp, JSON.stringify(sources), job.description ?? null, applyType, String(existing.id));
        continue;
      }
      const id = randomUUID();
      const postedAt = job.postedAt && !Number.isNaN(Date.parse(job.postedAt)) ? new Date(job.postedAt).toISOString() : null;
      insert.run(
        id,
        job.fingerprint,
        job.source,
        JSON.stringify(job.sources),
        job.externalId,
        job.url,
        job.applyUrl ?? null,
        job.applyType,
        job.title,
        job.company,
        job.location ?? null,
        job.remoteScope,
        job.language ?? null,
        job.description ?? null,
        postedAt,
        timestamp,
        timestamp,
      );
      insertedIds.push(id);
    }
    return { insertedIds };
  });
}

export function unscoredJobs(db: RadarDb, limit: number): JobRow[] {
  return (db.prepare("select * from jobs where score is null order by first_seen_at desc limit ?").all(limit) as SqlRow[]).map(toJobRow);
}

export function countUnscored(db: RadarDb): number {
  return Number((db.prepare("select count(*) as total from jobs where score is null").get() as SqlRow).total);
}

export function saveScore(
  db: RadarDb,
  id: string,
  score: { score: number; reason: string; requirements: string[]; language: string | null; skipReason?: string },
): void {
  db.prepare(
    `update jobs set score = ?, score_reason = ?, requirements = ?, language = coalesce(?, language), scored_at = ?,
       status = case when ? is not null and status = 'new' then 'skipped' else status end,
       status_reason = coalesce(?, status_reason)
     where id = ?`,
  ).run(score.score, score.reason, JSON.stringify(score.requirements), score.language, now(), score.skipReason ?? null, score.skipReason ?? null, id);
}

export function jobsByIds(db: RadarDb, ids: string[]): JobRow[] {
  if (ids.length === 0) return [];
  const rows: JobRow[] = [];
  for (let start = 0; start < ids.length; start += 500) {
    const chunk = ids.slice(start, start + 500);
    const placeholders = chunk.map(() => "?").join(",");
    rows.push(...(db.prepare(`select * from jobs where id in (${placeholders})`).all(...chunk) as SqlRow[]).map(toJobRow));
  }
  return rows;
}

export function jobById(db: RadarDb, id: string): JobRow {
  const row = db.prepare("select * from jobs where id = ?").get(id) as SqlRow | undefined;
  if (!row) throw new Error(`Vaga ${id} não encontrada`);
  return toJobRow(row);
}

export function recordSourceRun(
  db: RadarDb,
  run: { runId: string; source: string; ok: boolean; fetched: number; kept: number; inserted: number; error?: string; durationMs: number },
): void {
  db.prepare(
    "insert into source_runs (run_id, source, ok, fetched, kept, inserted, error, duration_ms, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(run.runId, run.source, run.ok ? 1 : 0, run.fetched, run.kept, run.inserted, run.error ?? null, run.durationMs, now());
}

/** Queue for the apply skill: approved by hand, or still new and above the cutoff. */
export function applyQueue(db: RadarDb, cutoff: number, limit: number): JobRow[] {
  return (
    db
      .prepare(
        `select * from jobs where status = 'approved' or (status = 'new' and score >= ?)
         order by (status = 'approved') desc, score desc limit ?`,
      )
      .all(cutoff, limit) as SqlRow[]
  ).map(toJobRow);
}

export function appliedTodayByPlatform(db: RadarDb): Record<string, number> {
  const rows = db
    .prepare("select platform, count(*) as total from application_events where status = 'applied' and created_at >= ? group by platform")
    .all(startOfLocalDay()) as SqlRow[];
  return Object.fromEntries(rows.map((row) => [String(row.platform), Number(row.total)]));
}

export function markJob(db: RadarDb, input: { id: string; status: JobStatus; platform: string; reason?: string; cvUsed?: string }): JobRow {
  return transaction(db, () => {
    const timestamp = now();
    const result = db
      .prepare(
        `update jobs set status = ?, status_reason = ?, cv_used = coalesce(?, cv_used),
           applied_at = case when ? = 'applied' then ? else applied_at end
         where id = ?`,
      )
      .run(input.status, input.reason ?? null, input.cvUsed ?? null, input.status, timestamp, input.id);
    if (result.changes === 0) throw new Error(`Vaga ${input.id} não encontrada`);
    db.prepare("insert into application_events (job_id, platform, status, reason, created_at) values (?, ?, ?, ?, ?)").run(
      input.id,
      input.platform,
      input.status,
      input.reason ?? null,
      timestamp,
    );
    return jobById(db, input.id);
  });
}

/** Approved jobs whose company was not searched for contacts yet. One entry per company. */
export function jobsNeedingContacts(db: RadarDb, limit: number): JobRow[] {
  const rows = (
    db
      .prepare("select * from jobs where status = 'approved' and contacts_searched_at is null order by score desc limit ?")
      .all(limit * 3) as SqlRow[]
  ).map(toJobRow);
  const byCompany = new Map<string, JobRow>();
  for (const job of rows) if (!byCompany.has(job.company.toLowerCase())) byCompany.set(job.company.toLowerCase(), job);
  return [...byCompany.values()].slice(0, limit);
}

export function contactsSearchedToday(db: RadarDb): number {
  const row = db
    .prepare("select count(distinct company) as total from jobs where contacts_searched_at >= ?")
    .get(startOfLocalDay()) as SqlRow;
  return Number(row.total);
}

export interface NewContact {
  name: string;
  title: string | null;
  kind: JobContactRow["kind"];
  linkedin_url: string;
  why: string | null;
  message_draft: string | null;
}

export function saveContacts(db: RadarDb, job: JobRow, contacts: NewContact[]): number {
  const upsert = db.prepare(
    `insert into job_contacts (id, job_id, company, name, title, kind, linkedin_url, why, message_draft, found_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (job_id, linkedin_url) do update set
       name = excluded.name, title = excluded.title, kind = excluded.kind, why = excluded.why, message_draft = excluded.message_draft`,
  );
  return transaction(db, () => {
    const timestamp = now();
    for (const contact of contacts) {
      upsert.run(randomUUID(), job.id, job.company, contact.name, contact.title, contact.kind, contact.linkedin_url, contact.why, contact.message_draft, timestamp);
    }
    // Every open job at the same company counts as searched, so the skill doesn't repeat the search.
    db.prepare("update jobs set contacts_searched_at = ? where company = ? and contacts_searched_at is null").run(timestamp, job.company);
    return contacts.length;
  });
}
