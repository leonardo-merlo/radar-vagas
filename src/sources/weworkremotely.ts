import { XMLParser } from "fast-xml-parser";
import { fetchText } from "../core/http.js";
import type { RawJob, Source } from "../core/types.js";

const FEEDS = [
  "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
];

interface RssItem {
  title?: string;
  region?: string;
  country?: string;
  link?: string;
  guid?: string | { "#text": string };
  pubDate?: string;
  description?: string;
}

const parser = new XMLParser({ ignoreAttributes: true, processEntities: true });

export const weworkremotely: Source = {
  name: "weworkremotely",
  async fetchJobs() {
    const jobs: RawJob[] = [];
    for (const feed of FEEDS) {
      const xml = await fetchText("weworkremotely", feed);
      const parsed = parser.parse(xml) as { rss?: { channel?: { item?: RssItem | RssItem[] } } };
      const raw = parsed.rss?.channel?.item;
      const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const item of items) {
        if (!item.title || !item.link) continue;
        const separator = item.title.indexOf(":");
        const company = separator > 0 ? item.title.slice(0, separator) : "Empresa não informada";
        const title = separator > 0 ? item.title.slice(separator + 1).trim() : item.title;
        const guid = typeof item.guid === "string" ? item.guid : item.guid?.["#text"];
        const hint = [item.region, item.country].filter(Boolean).join(", ");
        jobs.push({
          source: "weworkremotely",
          externalId: guid ?? item.link,
          url: item.link,
          applyType: "external",
          title,
          company,
          location: hint || undefined,
          locationHint: hint,
          remoteFlag: true,
          description: item.description,
          postedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
          language: "en",
        });
      }
    }
    return jobs;
  },
};
