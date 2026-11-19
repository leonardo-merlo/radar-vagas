import { decodeEntities } from "../core/html.js";
import { fetchText, sleep } from "../core/http.js";
import { tolerate, type RawJob, type Source } from "../core/types.js";

export function parseProgramathorPage(html: string): RawJob[] {
  const cells = html.split('<div class="cell-list ').slice(1);
  return cells.flatMap((cell): RawJob[] => {
    const href = cell.match(/<a href="(\/jobs\/(\d+)-[^"]+)"/);
    const title = cell.match(/<h3[^>]*>([^<]+)/)?.[1];
    if (!href?.[1] || !href[2] || !title) return [];
    const span = (icon: string): string | undefined => {
      const value = cell.match(new RegExp(`<i class='[^']*${icon}'></i>([^<]+)`))?.[1];
      return value ? decodeEntities(value).trim() : undefined;
    };
    const tags = [...cell.matchAll(/tag-list[^>]*>([^<]+)</g)].map((match) => match[1]).join(", ");
    const location = span("fa-map-marker-alt");
    return [
      {
        source: "programathor",
        externalId: href[2],
        url: `https://programathor.com.br${href[1]}`,
        applyType: "form",
        title: decodeEntities(title).trim(),
        company: span("fa-briefcase") ?? "Empresa não informada",
        location,
        locationHint: location,
        seniorityHint: span("fa-chart-bar"),
        description: [span("fa-chart-bar"), span("fa-file-alt"), tags && `Tecnologias: ${tags}`].filter(Boolean).join(" · "),
        language: "pt",
      },
    ];
  });
}

export const programathor: Source = {
  name: "programathor",
  async fetchJobs(context) {
    const jobs: RawJob[] = [];
    for (const search of context.broadTermsBr) {
      for (let page = 1; page <= 2; page++) {
        const url = `https://programathor.com.br/jobs/page/${page}?search=${encodeURIComponent(search)}`;
        const html = await tolerate(context, `programathor "${search}" p${page}`, () => fetchText("programathor", url));
        const found = html ? parseProgramathorPage(html) : [];
        jobs.push(...found);
        await sleep(2500);
        if (found.length === 0) break;
      }
    }
    return jobs;
  },
};
