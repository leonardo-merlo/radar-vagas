import { fetchJson, sleep } from "../core/http.js";
import { tolerate, type RawJob, type Source } from "../core/types.js";

interface HimalayasJob {
  guid: string;
  title: string;
  companyName: string;
  description?: string;
  excerpt?: string;
  seniority?: string[];
  locationRestrictions?: string[];
  pubDate?: number;
  applicationLink: string;
}

interface HimalayasResponse {
  jobs: HimalayasJob[];
}

export const himalayas: Source = {
  name: "himalayas",
  async fetchJobs(context) {
    const jobs: RawJob[] = [];
    for (const keyword of context.keywordsIntl) {
      const url = `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(keyword)}&page=1`;
      const data = await tolerate(context, `himalayas "${keyword}"`, () => fetchJson<HimalayasResponse>("himalayas", url));
      for (const job of data?.jobs ?? []) {
        const restrictions = job.locationRestrictions ?? [];
        jobs.push({
          source: "himalayas",
          externalId: job.guid,
          url: job.applicationLink,
          applyType: "external",
          title: job.title,
          company: job.companyName,
          location: restrictions.join(", ") || "Worldwide",
          locationHint: restrictions.length === 0 ? "Worldwide" : restrictions.join(", "),
          remoteFlag: true,
          description: job.description ?? job.excerpt,
          seniorityHint: job.seniority?.join(", "),
          postedAt: job.pubDate ? new Date(job.pubDate * 1000).toISOString() : undefined,
          language: "en",
        });
      }
      await sleep(500);
    }
    return jobs;
  },
};
