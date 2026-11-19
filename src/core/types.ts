import type { ApplyType, RemoteScope, Seniority } from "../db/database.types.js";

export interface RawJob {
  source: SourceName;
  externalId: string;
  url: string;
  applyUrl?: string;
  applyType: ApplyType;
  title: string;
  company: string;
  location?: string;
  /** Free text the source gives about where candidates may live ("USA Only", "Europe", "Remoto"). */
  locationHint?: string;
  /** True when the source itself flags the job as remote. */
  remoteFlag?: boolean;
  /** Level as the board labels it ("Entry-level", "Júnior/Trainee"), when it has such a field. */
  seniorityHint?: string;
  description?: string;
  postedAt?: string;
  language?: "pt" | "en";
}

export interface NormalizedJob extends RawJob {
  sources: SourceName[];
  seniority: Seniority;
  fingerprint: string;
  remoteScope: RemoteScope;
}

export type SourceName =
  | "linkedin"
  | "gupy"
  | "indeed"
  | "programathor"
  | "trampos"
  | "vagas"
  | "geekhunter"
  | "wellfound"
  | "weworkremotely"
  | "remoteok"
  | "remoteco"
  | "himalayas"
  | "flexjobs";

export interface SourceContext {
  keywordsBr: string[];
  keywordsIntl: string[];
  wellfoundRoles: string[];
  maxDetailFetches: number;
  /** Generic Portuguese terms for boards whose search is too literal for the long keywords. */
  broadTermsBr: string[];
  /** Partial failures (one page or keyword) that did not stop the source. */
  warnings: string[];
}

export interface Source {
  name: SourceName;
  fetchJobs(context: SourceContext): Promise<RawJob[]>;
}

/** Runs one step of a source; logs a failure as a warning so the other steps still count. */
export async function tolerate<T>(context: SourceContext, label: string, step: () => Promise<T>): Promise<T | undefined> {
  try {
    return await step();
  } catch (error) {
    context.warnings.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

export class SourceBlockedError extends Error {
  constructor(source: SourceName, detail: string) {
    super(`${source}: ${detail}`);
    this.name = "SourceBlockedError";
  }
}
