import { extractNextData } from "../core/html.js";
import { fetchText, sleep } from "../core/http.js";
import { SourceBlockedError, tolerate, type RawJob, type Source } from "../core/types.js";

interface ApolloRef {
  __ref: string;
}

interface JobListing {
  __typename: "JobListingSearchResult";
  id: string;
  slug: string;
  title: string;
  description?: string;
  remote?: boolean;
  acceptedRemoteLocationNames?: string[];
  locationNames?: string[];
  liveStartAt?: number;
  compensation?: string;
  yearsExperienceMin?: number | null;
}

interface Startup {
  __typename: "StartupResult";
  name: string;
  highlightedJobListings?: ApolloRef[];
}

type ApolloEntry = { __typename: string } & Partial<Omit<JobListing, "__typename">> & Partial<Omit<Startup, "__typename">>;

export function parseWellfoundPage(html: string): RawJob[] {
  const next = extractNextData(html) as
    | { props?: { pageProps?: { apolloState?: { data?: Record<string, ApolloEntry> } } } }
    | undefined;
  const state = next?.props?.pageProps?.apolloState?.data;
  if (!state) throw new SourceBlockedError("wellfound", "página sem dados (provável bloqueio anti-bot)");

  const companyByJob = new Map<string, string>();
  for (const entry of Object.values(state)) {
    if (entry.__typename !== "StartupResult" || !entry.name) continue;
    for (const ref of entry.highlightedJobListings ?? []) companyByJob.set(ref.__ref, entry.name);
  }

  return Object.entries(state).flatMap(([key, job]): RawJob[] => {
    if (job.__typename !== "JobListingSearchResult" || !job.id || !job.title) return [];
    const accepted = job.acceptedRemoteLocationNames ?? [];
    const experience = job.yearsExperienceMin != null ? `Experiência mínima: ${job.yearsExperienceMin} anos.` : "";
    return [
      {
        source: "wellfound",
        externalId: job.id,
        url: `https://wellfound.com/jobs/${job.id}-${job.slug ?? ""}`,
        applyType: "form",
        title: job.title,
        company: companyByJob.get(key) ?? "Empresa não informada",
        location: accepted.join(", ") || (job.locationNames ?? []).join(", ") || undefined,
        locationHint: accepted.join(", "),
        remoteFlag: job.remote === true,
        description: [experience, job.compensation, job.description].filter(Boolean).join("\n"),
        postedAt: job.liveStartAt ? new Date(job.liveStartAt * 1000).toISOString() : undefined,
        language: "en",
      },
    ];
  });
}

export const wellfound: Source = {
  name: "wellfound",
  async fetchJobs(context) {
    const jobs: RawJob[] = [];
    for (const role of context.wellfoundRoles) {
      const found = await tolerate(context, `wellfound ${role}`, async () =>
        parseWellfoundPage(await fetchText("wellfound", `https://wellfound.com/role/r/${role}`)),
      );
      jobs.push(...(found ?? []));
      await sleep(1500);
    }
    return jobs;
  },
};
