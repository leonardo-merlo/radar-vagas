import { decodeEntities, stripHtml } from "../core/html.js";
import { fetchText, sleep } from "../core/http.js";
import { slugify } from "../core/text.js";
import { tolerate, type RawJob, type Source } from "../core/types.js";

function clean(value: string | undefined): string | undefined {
  return value ? decodeEntities(stripHtml(value)).replace(/\s+/g, " ").trim() : undefined;
}

export function parseVagasPage(html: string): RawJob[] {
  const cards = html.split(/<li class="vaga /).slice(1);
  return cards.flatMap((card): RawJob[] => {
    const id = card.match(/data-id-vaga="(\d+)"/)?.[1];
    const title = card.match(/title="([^"]+)"/)?.[1];
    const href = card.match(/href="(\/vagas\/v\d+[^"]*)"/)?.[1];
    if (!id || !title || !href) return [];
    const location = clean(card.match(/class="vaga-local">([\s\S]*?)<div class="tooltip/)?.[1]);
    const date = card.match(/data-publicacao">[\s\S]*?(\d{2})\/(\d{2})\/(\d{4})/);
    return [
      {
        source: "vagas",
        externalId: id,
        url: `https://www.vagas.com.br${href}`,
        applyType: "form",
        title: decodeEntities(title),
        company: clean(card.match(/class="emprVaga">([\s\S]*?)<\/span>/)?.[1]) ?? "Empresa não informada",
        location,
        locationHint: location,
        seniorityHint: clean(card.match(/class="nivelVaga">([\s\S]*?)<\/span>/)?.[1]),
        description: clean(card.match(/class="detalhes">([\s\S]*?)<\/div>/)?.[1]),
        postedAt: date ? `${date[3]}-${date[2]}-${date[1]}` : undefined,
        language: "pt",
      },
    ];
  });
}

export const vagas: Source = {
  name: "vagas",
  async fetchJobs(context) {
    const jobs: RawJob[] = [];
    for (const keyword of context.keywordsBr) {
      const url = `https://www.vagas.com.br/vagas-de-${slugify(keyword)}`;
      const html = await tolerate(context, `vagas "${keyword}"`, () => fetchText("vagas", url));
      if (html) jobs.push(...parseVagasPage(html));
      await sleep(800);
    }
    return jobs;
  },
};
