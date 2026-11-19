import type { JobStatus, RemoteScope } from "./database.types";

export const SOURCES = [
  "linkedin",
  "gupy",
  "programathor",
  "trampos",
  "vagas",
  "geekhunter",
  "wellfound",
  "weworkremotely",
  "remoteok",
  "himalayas",
] as const;

export const STATUS_LABEL: Record<JobStatus, string> = {
  new: "Nova",
  approved: "Aprovada",
  applied: "Candidatada",
  pending_me: "Pendente de você",
  failed: "Falhou",
  skipped: "Descartada",
};

export const SCOPE_LABEL: Record<RemoteScope, string> = {
  brazil: "Remota Brasil",
  latam: "Remota LATAM",
  worldwide: "Remota mundo",
  europe: "Remota Europa",
  unknown: "Remota, sem região",
};

export const PERIODS = { "1": "Hoje", "7": "7 dias", "30": "30 dias", "90": "90 dias", todos: "Tudo" } as const;
export type Period = keyof typeof PERIODS;

export interface JobFilters {
  status: JobStatus | "todas" | "abertas";
  scope: RemoteScope | "todas";
  language: "pt" | "en" | "todas";
  source: (typeof SOURCES)[number] | "todas";
  location: string;
  query: string;
  minScore: number;
  period: Period;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(params: RawParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function parseFilters(params: RawParams): JobFilters {
  const minScore = Number(first(params, "nota") ?? 0);
  const page = Number(first(params, "pagina") ?? 1);
  return {
    status: oneOf(first(params, "status"), ["todas", "abertas", ...(Object.keys(STATUS_LABEL) as JobStatus[])], "abertas"),
    scope: oneOf(first(params, "remota"), ["todas", ...(Object.keys(SCOPE_LABEL) as RemoteScope[])], "todas"),
    language: oneOf(first(params, "idioma"), ["todas", "pt", "en"], "todas"),
    source: oneOf(first(params, "fonte"), ["todas", ...SOURCES], "todas"),
    location: (first(params, "local") ?? "").trim().slice(0, 60),
    query: (first(params, "q") ?? "").trim().slice(0, 80),
    minScore: Number.isFinite(minScore) ? Math.min(100, Math.max(0, Math.round(minScore))) : 0,
    period: oneOf(first(params, "periodo"), Object.keys(PERIODS) as Period[], "30"),
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
  };
}

/** Start of the period in São Paulo time, as an ISO string; undefined for "todos". */
export function periodStart(period: Period, now = new Date()): string | undefined {
  if (period === "todos") return undefined;
  const days = Number(period);
  const start = new Date(now.getTime() - (days - 1) * 86_400_000);
  const saoPauloDate = start.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${saoPauloDate}T00:00:00-03:00`).toISOString();
}

/** Escapes characters that have meaning inside a PostgREST ilike pattern or or-filter. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_,()*]/g, " ").trim()}%`;
}

export function toSearch(filters: JobFilters, overrides: Partial<JobFilters> = {}): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (merged.status !== "abertas") params.set("status", merged.status);
  if (merged.scope !== "todas") params.set("remota", merged.scope);
  if (merged.language !== "todas") params.set("idioma", merged.language);
  if (merged.source !== "todas") params.set("fonte", merged.source);
  if (merged.location) params.set("local", merged.location);
  if (merged.query) params.set("q", merged.query);
  if (merged.minScore > 0) params.set("nota", String(merged.minScore));
  if (merged.period !== "30") params.set("periodo", merged.period);
  if (merged.page > 1) params.set("pagina", String(merged.page));
  const search = params.toString();
  return search ? `?${search}` : "";
}
