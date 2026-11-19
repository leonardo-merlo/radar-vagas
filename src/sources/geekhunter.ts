import { extractJsonLd } from "../core/html.js";
import { fetchText, mapLimited } from "../core/http.js";
import { isTargetRole } from "../core/text.js";
import type { RawJob, Source } from "../core/types.js";

interface ListItem {
  url: string;
  name: string;
}

interface JobPosting {
  "@type"?: string;
  title?: string;
  url?: string;
  datePosted?: string;
  description?: string;
  skills?: string;
  jobLocationType?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: { address?: { addressLocality?: string; addressCountry?: string } }[];
}

function findItemList(blocks: unknown[]): ListItem[] {
  for (const block of blocks) {
    const list = (block as { itemListElement?: ListItem[] }).itemListElement;
    if (Array.isArray(list)) return list;
  }
  return [];
}

export const geekhunter: Source = {
  name: "geekhunter",
  async fetchJobs({ maxDetailFetches }) {
    const listing: ListItem[] = [];
    for (let page = 1; page <= 3; page++) {
      listing.push(...findItemList(extractJsonLd(await fetchText("geekhunter", `https://www.geekhunter.com.br/vagas?page=${page}`))));
    }
    const candidates = [...new Map(listing.map((item) => [item.url, item])).values()]
      .filter((item) => isTargetRole(item.name))
      .slice(0, maxDetailFetches);

    const details = await mapLimited(candidates, 3, async (item) => {
      const blocks = extractJsonLd(await fetchText("geekhunter", item.url));
      return blocks.find((block): block is JobPosting => (block as JobPosting)["@type"] === "JobPosting");
    });

    return details.flatMap((posting, index): RawJob[] => {
      const item = candidates[index];
      if (!posting || !item) return [];
      const place = posting.jobLocation?.[0]?.address?.addressLocality;
      const text = `${posting.title ?? ""} ${posting.description ?? ""}`.toLowerCase();
      const remote = posting.jobLocationType === "TELECOMMUTE" || /remot|home office/.test(text);
      return [
        {
          source: "geekhunter",
          externalId: item.url,
          url: item.url,
          applyType: "form",
          title: posting.title ?? item.name,
          company: posting.hiringOrganization?.name ?? "Empresa não informada",
          location: remote ? "Remoto" : place,
          remoteFlag: remote,
          description: [posting.description, posting.skills && `Skills: ${posting.skills}`].filter(Boolean).join("\n"),
          postedAt: posting.datePosted,
          language: "pt",
        },
      ];
    });
  },
};
