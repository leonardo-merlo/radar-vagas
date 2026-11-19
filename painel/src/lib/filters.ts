import type { JobStatus, RemoteScope, Seniority } from "./database.types";

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

export const SENIORITY_LABEL: Record<Seniority, string> = {
  junior: "Júnior",
  pleno: "Pleno",
  senior: "Sênior",
  nao_definido: "Não definido",
};

export const PERIODS = { "1": "Hoje", "7": "7 dias", "30": "30 dias", "90": "90 dias", todos: "Tudo" } as const;
export type Period = keyof typeof PERIODS;

export const SORTS = { nota: "Nota", recentes: "Data" } as const;
export type Sort = keyof typeof SORTS;

export interface JobFilters {
  status: JobStatus | "todas" | "abertas";
  scope: RemoteScope | "todas";
  seniority: Seniority | "todos";
  language: "pt" | "en" | "todas";
  source: (typeof SOURCES)[number] | "todas";
  location: string;
  query: string;
  minScore: number;
  period: Period;
  sort: Sort;
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
    seniority: oneOf(first(params, "nivel"), ["todos", ...(Object.keys(SENIORITY_LABEL) as Seniority[])], "todos"),
    language: oneOf(first(params, "idioma"), ["todas", "pt", "en"], "todas"),
    source: oneOf(first(params, "fonte"), ["todas", ...SOURCES], "todas"),
    location: (first(params, "local") ?? "").trim().slice(0, 60),
    query: (first(params, "q") ?? "").trim().slice(0, 80),
    minScore: Number.isFinite(minScore) ? Math.min(100, Math.max(0, Math.round(minScore))) : 0,
    period: oneOf(first(params, "periodo"), Object.keys(PERIODS) as Period[], "30"),
    sort: oneOf(first(params, "ordem"), Object.keys(SORTS) as Sort[], "nota"),
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
  if (merged.seniority !== "todos") params.set("nivel", merged.seniority);
  if (merged.language !== "todas") params.set("idioma", merged.language);
  if (merged.source !== "todas") params.set("fonte", merged.source);
  if (merged.location) params.set("local", merged.location);
  if (merged.query) params.set("q", merged.query);
  if (merged.minScore > 0) params.set("nota", String(merged.minScore));
  if (merged.period !== "30") params.set("periodo", merged.period);
  if (merged.sort !== "nota") params.set("ordem", merged.sort);
  if (merged.page > 1) params.set("pagina", String(merged.page));
  const search = params.toString();
  return search ? `?${search}` : "";
}

export interface PostedDate {
  date: string;
  relative: string;
  /** True when the board gives no publish date and we show when the radar first saw the job. */
  seenOnly: boolean;
}

const DAY_MS = 86_400_000;

function calendarDay(iso: string): string {
  // Boards that only give a day ("2026-11-18") are stored as UTC midnight; read those in UTC
  // so they don't slide to the previous day in São Paulo time.
  const timeZone = iso.endsWith("T00:00:00.000Z") ? "UTC" : "America/Sao_Paulo";
  return new Date(iso).toLocaleDateString("en-CA", { timeZone });
}

export function postedDate(postedAt: string | null, firstSeenAt: string, now = new Date()): PostedDate {
  const source = postedAt ?? firstSeenAt;
  const day = calendarDay(source);
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(day)) / DAY_MS));
  const [year, month, date] = day.split("-");
  const relative = days === 0 ? "hoje" : days === 1 ? "ontem" : days < 60 ? `há ${days} dias` : `há ${Math.round(days / 30)} meses`;
  return { date: `${date}/${month}/${year}`, relative, seenOnly: postedAt == null };
}
