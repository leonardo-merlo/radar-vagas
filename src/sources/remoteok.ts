import { fetchJson } from "../core/http.js";
import { isTargetRole } from "../core/text.js";
import type { RawJob, Source } from "../core/types.js";

interface RemoteOkJob {
  id?: string;
  slug?: string;
  date?: string;
  company?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  apply_url?: string;
  url?: string;
}

// Public API; their terms ask for a link back to the job URL, which we keep.
export const remoteok: Source = {
  name: "remoteok",
  async fetchJobs() {
    const data = await fetchJson<RemoteOkJob[]>("remoteok", "https://remoteok.com/api");
    return data
      .filter((job): job is Required<Pick<RemoteOkJob, "id" | "position" | "company" | "url">> & RemoteOkJob =>
        Boolean(job.id && job.position && job.company && job.url),
      )
      .filter((job) => isTargetRole(`${job.position} ${(job.tags ?? []).join(" ")}`))
      .map(
        (job): RawJob => ({
          source: "remoteok",
          externalId: job.id,
          url: job.url,
          applyUrl: job.apply_url,
          applyType: "external",
          title: job.position,
          company: job.company,
          location: job.location || undefined,
          locationHint: job.location || "Worldwide",
          remoteFlag: true,
          description: job.description,
          postedAt: job.date,
          language: "en",
        }),
      );
  },
};
