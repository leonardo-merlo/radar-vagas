import { fetchJson, mapLimited } from "../core/http.js";
import type { RawJob, Source } from "../core/types.js";

interface TramposListItem {
  id: number;
  name: string;
  apply_url?: string;
  city?: string;
  state?: string;
  published_at?: string;
  custom_company_name?: string;
  company?: { name?: string } | null;
}

interface TramposDetail {
  opportunity: TramposListItem & { home_office?: boolean; description?: string; prerequisites?: string };
}

const LIST = "https://trampos.co/api/v2/opportunities?ct[]=ti&ct[]=programacao";

export const trampos: Source = {
  name: "trampos",
  async fetchJobs({ maxDetailFetches }) {
    const items: TramposListItem[] = [];
    for (let page = 1; page <= 3; page++) {
      const data = await fetchJson<{ opportunities: TramposListItem[] }>("trampos", `${LIST}&page=${page}`);
      items.push(...data.opportunities);
      if (data.opportunities.length < 12) break;
    }
    const details = await mapLimited(items.slice(0, maxDetailFetches), 3, (item) =>
      fetchJson<TramposDetail>("trampos", `https://trampos.co/api/v2/opportunities/${item.id}`),
    );
    return details.flatMap((detail): RawJob[] => {
      const job = detail?.opportunity;
      if (!job) return [];
      return [
        {
          source: "trampos",
          externalId: String(job.id),
          url: `https://trampos.co/oportunidades/${job.id}`,
          applyUrl: job.apply_url || undefined,
          applyType: job.apply_url ? "external" : "form",
          title: job.name,
          company: job.company?.name || job.custom_company_name || "Empresa não informada",
          location: [job.city, job.state].filter(Boolean).join(" / "),
          remoteFlag: job.home_office === true,
          description: [job.description, job.prerequisites].filter(Boolean).join("\n\n"),
          postedAt: job.published_at,
          language: "pt",
        },
      ];
    });
  },
};
