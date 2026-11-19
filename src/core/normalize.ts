import { createHash } from "node:crypto";
import { stripHtml, truncate } from "./html.js";
import { classifyRemoteScope } from "./location.js";
import { detectSeniority } from "./seniority.js";
import { simplify } from "./text.js";
import type { NormalizedJob, RawJob } from "./types.js";

const COMPANY_SUFFIXES = /\b(ltda|ltd|inc|llc|s\.?a\.?|gmbh|corp|corporation|co|limited|me|eireli|tecnologia|technologies|technology)\b/g;
const TITLE_NOISE = /\b(remote|remoto|remota|home office|100%|vaga|hiring|urgent|urgente|ref#?\s*\d+|\d{4,})\b/g;

export function fingerprintOf(company: string, title: string): string {
  const companyKey = simplify(company).replace(COMPANY_SUFFIXES, "").replace(/\s+/g, " ").trim();
  const titleKey = simplify(title).replace(TITLE_NOISE, "").replace(/\s+/g, " ").trim();
  return createHash("sha1").update(`${companyKey}|${titleKey}`).digest("hex");
}

export function normalizeJob(raw: RawJob): NormalizedJob {
  const description = raw.description ? truncate(stripHtml(raw.description), 6000) : undefined;
  const title = raw.title.replace(/\s+/g, " ").trim();
  const company = raw.company.replace(/\s+/g, " ").trim() || "Empresa não informada";
  return {
    ...raw,
    title,
    company,
    description,
    sources: [raw.source],
    seniority: detectSeniority(title, raw.seniorityHint, description),
    fingerprint: fingerprintOf(company, title),
    remoteScope: classifyRemoteScope(raw),
  };
}

/** Keeps the first occurrence of each fingerprint within one run. */
export function dedupe(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Map<string, NormalizedJob>();
  for (const job of jobs) {
    const existing = seen.get(job.fingerprint);
    if (!existing) {
      seen.set(job.fingerprint, job);
      continue;
    }
    const sources = [...new Set([...existing.sources, ...job.sources])];
    const better = !existing.description && job.description ? job : existing;
    seen.set(job.fingerprint, { ...better, source: existing.source, sources });
  }
  return [...seen.values()];
}
