import type { RemoteScope } from "../db/database.types.js";
import { simplify } from "./text.js";
import type { RawJob, SourceName } from "./types.js";

export type Eligibility = RemoteScope | "excluded";

const BRAZILIAN_SOURCES: ReadonlySet<SourceName> = new Set([
  "gupy",
  "vagas",
  "programathor",
  "trampos",
  "geekhunter",
  "indeed",
]);

const WORLDWIDE = /\b(worldwide|anywhere|global|globally|world|any location|fully remote|100 remote|remote first)\b/;
const LATAM = /\b(latam|latin america|south america|americas|brazil|brasil|sao paulo|rio de janeiro|minas gerais|argentina|mexico|colombia|chile|uruguay|peru)\b/;
const EUROPE =
  /\b(europe|european union|eu|emea|eea|portugal|spain|germany|france|netherlands|ireland|italy|poland|belgium|austria|sweden|denmark|finland|czech|romania|greece|lisbon|berlin|madrid|amsterdam|barcelona)\b/;
const RESTRICTED =
  /\b(usa|us only|united states|u s|canada|uk only|united kingdom|asia|india|philippines|australia|new zealand|japan|singapore|pakistan|nigeria|africa|israel|california|new york|texas|florida|ny|ca|tx|est|pst|cst)\b/;
const RESTRICTED_PHRASES = [
  /\b(us|u s|united states) (citizens?|residents?|persons?)( only)?\b/,
  /\bmust (be )?(based|located|reside|living) in the (us|u s|united states|uk|united kingdom|canada)\b/,
  /\bauthorized to work in the (us|u s|united states)\b/,
  /\bsecurity clearance\b/,
  /\b(us|usa) only\b/,
];
const REMOTE_PT = /\b(remoto|remota|home office|100 remoto|trabalho remoto|anywhere|remote)\b/;

export function eligibility(job: RawJob): Eligibility {
  const place = simplify([job.locationHint ?? "", job.location ?? ""].join(" "));
  const body = simplify((job.description ?? "").slice(0, 3000));

  if (BRAZILIAN_SOURCES.has(job.source) || (job.source === "linkedin" && job.language === "pt")) {
    if (job.remoteFlag === false) return "excluded";
    if (job.remoteFlag === true || REMOTE_PT.test(place) || REMOTE_PT.test(simplify(job.title))) return "brazil";
    return "excluded";
  }

  if (job.remoteFlag === false) return "excluded";

  if (WORLDWIDE.test(place)) return "worldwide";
  if (LATAM.test(place)) return place.includes("brazil") || place.includes("brasil") ? "brazil" : "latam";
  if (EUROPE.test(place)) return "europe";
  if (RESTRICTED.test(place)) return "excluded";
  if (RESTRICTED_PHRASES.some((pattern) => pattern.test(body))) return "excluded";
  if (WORLDWIDE.test(body)) return "worldwide";
  return "unknown";
}

export function classifyRemoteScope(job: RawJob): RemoteScope {
  const result = eligibility(job);
  return result === "excluded" ? "unknown" : result;
}
