const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z#0-9]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|h\d|div)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export function extractNextData(html: string): unknown {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match?.[1]) return undefined;
  return JSON.parse(match[1]);
}

export function extractJsonLd(html: string): unknown[] {
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  const parsed: unknown[] = [];
  for (const block of blocks) {
    try {
      parsed.push(JSON.parse(block[1] ?? ""));
    } catch {
      // Malformed ld+json blocks are common; skip them.
    }
  }
  return parsed;
}

export function truncate(text: string | undefined, max: number): string | undefined {
  if (!text) return text;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
