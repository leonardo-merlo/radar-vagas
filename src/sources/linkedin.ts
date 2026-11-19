import { decodeEntities, stripHtml } from "../core/html.js";
import { fetchText, sleep } from "../core/http.js";
import { tolerate, type RawJob, type Source } from "../core/types.js";

// Public guest endpoints (no login). f_WT=2 = remote, f_TPR=r86400 = posted in the last 24h.
const SEARCH = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const DETAIL = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";
const PAGES = 2;

function pick(html: string, pattern: RegExp): string | undefined {
  const value = html.match(pattern)?.[1];
  return value ? decodeEntities(value).replace(/\s+/g, " ").trim() : undefined;
}

export function parseLinkedInCards(html: string, language: "pt" | "en"): RawJob[] {
  const cards = html.split(/<li>/).slice(1);
  const jobs: RawJob[] = [];
  for (const card of cards) {
    const id = pick(card, /urn:li:jobPosting:(\d+)/);
    const title = pick(card, /base-search-card__title">([\s\S]*?)<\/h3>/);
    if (!id || !title) continue;
    const company =
      pick(card, /base-search-card__subtitle">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/) ??
      pick(card, /base-search-card__subtitle">([\s\S]*?)<\/h4>/) ??
      "Empresa não informada";
    const location = pick(card, /job-search-card__location">([\s\S]*?)<\/span>/);
    jobs.push({
      source: "linkedin",
      externalId: id,
      url: `https://www.linkedin.com/jobs/view/${id}/`,
      applyType: "unknown",
      title,
      company,
      location,
      locationHint: location,
      remoteFlag: true,
      postedAt: pick(card, /datetime="([^"]+)"/),
      language,
    });
  }
  return jobs;
}

export function parseLinkedInDetail(html: string): Pick<RawJob, "description" | "applyType"> {
  const body = html.match(/class="description__text[^"]*"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  const offsite = /apply-button__offsite|offsite-apply/.test(html);
  return {
    description: body ? stripHtml(body) : undefined,
    applyType: offsite ? "external" : "easy_apply",
  };
}

export const linkedin: Source = {
  name: "linkedin",
  async fetchJobs(context) {
    const { keywordsBr, keywordsIntl, maxDetailFetches } = context;
    const searches = [
      ...keywordsBr.map((keyword) => ({ keyword, language: "pt" as const })),
      ...keywordsIntl.map((keyword) => ({ keyword, language: "en" as const })),
    ];
    const jobs: RawJob[] = [];
    for (const { keyword, language } of searches) {
      for (let page = 0; page < PAGES; page++) {
        const params = new URLSearchParams({
          keywords: keyword,
          location: "Brazil",
          f_WT: "2",
          f_TPR: "r86400",
          start: String(page * 25),
        });
        const html = await tolerate(context, `linkedin "${keyword}" p${page}`, () => fetchText("linkedin", `${SEARCH}?${params}`));
        const found = html ? parseLinkedInCards(html, language) : [];
        jobs.push(...found);
        await sleep(1200);
        if (found.length < 25) break;
      }
    }

    const unique = [...new Map(jobs.map((job) => [job.externalId, job])).values()];
    for (const job of unique.slice(0, maxDetailFetches)) {
      try {
        const detail = parseLinkedInDetail(await fetchText("linkedin", `${DETAIL}/${job.externalId}`));
        job.description = detail.description;
        job.applyType = detail.applyType;
      } catch {
        // Detail is optional; the job is still scored from its title.
      }
      await sleep(1500);
    }
    return unique;
  },
};
