import { simplify } from "./text.js";

import type { Seniority } from "../db/database.types.js";

export type { Seniority };

const LEVELS: { level: Exclude<Seniority, "nao_definido">; pattern: RegExp }[] = [
  { level: "junior", pattern: /\b(junior|jr|trainee|estagio|estagiario|estagiaria|intern|internship|entry level|entry|associate|graduate)\b/ },
  { level: "pleno", pattern: /\b(pleno|mid|mid level|midlevel|intermediate)\b/ },
  { level: "senior", pattern: /\b(senior|sr|lead|staff|principal|especialista|expert|head|architect|arquiteto)\b/ },
];

/** Reads explicit level words. When a title names two ("Júnior/Pleno"), keeps the lower one: it is the one that fits. */
function fromText(text: string): Seniority | undefined {
  const words = simplify(text);
  return LEVELS.find((entry) => entry.pattern.test(words))?.level;
}

/** "Software Engineer II": a roman numeral only means a level at the very end of a title. */
function fromRomanNumeral(title: string): Seniority | undefined {
  const numeral = title.trim().match(/\s(I{1,3})$/)?.[1];
  if (numeral === "I") return "junior";
  if (numeral === "II") return "pleno";
  if (numeral === "III") return "senior";
  return undefined;
}

const DESCRIPTION_LEVEL = /\b(nivel|level|senioridade|seniority)\s*:?\s*(junior|jr|pleno|mid|senior|sr)\b/;

export function detectSeniority(title: string, hint?: string, description?: string): Seniority {
  const fromTitle = fromText(title) ?? fromRomanNumeral(title);
  if (fromTitle) return fromTitle;
  const fromHint = hint ? fromText(hint) : undefined;
  if (fromHint) return fromHint;
  const level = description ? simplify(description.slice(0, 4000)).match(DESCRIPTION_LEVEL)?.[2] : undefined;
  return (level && fromText(level)) || "nao_definido";
}
