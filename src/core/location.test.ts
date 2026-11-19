import { describe, expect, it } from "vitest";
import { eligibility } from "./location.js";
import type { RawJob } from "./types.js";

function job(overrides: Partial<RawJob>): RawJob {
  return { source: "weworkremotely", externalId: "1", url: "https://x", applyType: "external", title: "Developer", company: "Acme", ...overrides };
}

describe("international remote jobs", () => {
  it("excludes jobs restricted to the US", () => {
    expect(eligibility(job({ locationHint: "USA Only" }))).toBe("excluded");
  });

  it("keeps worldwide, LATAM and Europe jobs", () => {
    expect(eligibility(job({ locationHint: "Anywhere in the World" }))).toBe("worldwide");
    expect(eligibility(job({ locationHint: "Latin America Only" }))).toBe("latam");
    expect(eligibility(job({ locationHint: "Europe" }))).toBe("europe");
  });

  it("prefers an accepted region over a restricted one in the same hint", () => {
    expect(eligibility(job({ locationHint: "United States, Brazil" }))).toBe("brazil");
  });

  it("excludes jobs whose description requires US work authorization", () => {
    expect(eligibility(job({ description: "You must be authorized to work in the United States." }))).toBe("excluded");
  });

  it("keeps jobs with no location information as unknown", () => {
    expect(eligibility(job({}))).toBe("unknown");
  });
});

describe("Brazilian boards", () => {
  it("keeps jobs flagged as remote", () => {
    expect(eligibility(job({ source: "gupy", remoteFlag: true }))).toBe("brazil");
  });

  it("excludes on-site jobs", () => {
    expect(eligibility(job({ source: "vagas", location: "Rio de Janeiro / RJ" }))).toBe("excluded");
  });

  it("accepts remote mentioned only in the location text", () => {
    expect(eligibility(job({ source: "programathor", location: "Remoto" }))).toBe("brazil");
  });
});
