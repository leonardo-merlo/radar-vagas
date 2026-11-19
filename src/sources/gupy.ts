import { extractNextData } from "../core/html.js";
import { fetchText, sleep } from "../core/http.js";
import { tolerate, type RawJob, type Source } from "../core/types.js";

interface GupyJob {
  id: number;
  name: string;
  description?: string;
  careerPageName?: string;
  publishedDate?: string;
  workplaceType?: string;
  city?: string;
  state?: string;
  jobUrl: string;
}

interface GupyJobList {
  data?: GupyJob[];
  pagination?: { total?: number; limit?: number; offset?: number };
}

const MAX_PAGES = 5;

// portal.api.gupy.io now answers 404; the public portal embeds the same list in __NEXT_DATA__.
// Pagination is `page=N` (1-based); `offset` in the URL is ignored.
export const gupy: Source = {
  name: "gupy",
  async fetchJobs(context) {
    const terms = [...new Set([...context.keywordsBr, ...context.broadTermsBr])];
    const jobs: RawJob[] = [];
    for (const term of terms) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `https://portal.gupy.io/job-search/term=${encodeURIComponent(term)}&workplaceTypes[]=remote&page=${page}`;
        const list = await tolerate(context, `gupy "${term}" p${page}`, async () => {
          const next = extractNextData(await fetchText("gupy", url)) as
            | { props?: { pageProps?: { initialJobList?: GupyJobList } } }
            | undefined;
          return next?.props?.pageProps?.initialJobList;
        });
        const data = list?.data ?? [];
        for (const job of data) {
          jobs.push({
            source: "gupy",
            externalId: String(job.id),
            url: job.jobUrl.replace(/\?.*$/, ""),
            applyType: "form",
            title: job.name,
            company: job.careerPageName ?? "Empresa não informada",
            location: [job.city, job.state].filter(Boolean).join(" / ") || "Remoto",
            remoteFlag: job.workplaceType === "remote",
            description: job.description,
            postedAt: job.publishedDate,
            language: "pt",
          });
        }
        const { total = 0, limit = 12, offset = 0 } = list?.pagination ?? {};
        if (data.length === 0 || offset + limit >= total) break;
        await sleep(400);
      }
    }
    return [...new Map(jobs.map((job) => [job.externalId, job])).values()];
  },
};
