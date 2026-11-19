import { describe, expect, it } from "vitest";
import type { JobRow } from "../db/database.types.js";
import { renderDigest, topJobs } from "./digest.js";

function row(overrides: Partial<JobRow>): JobRow {
  return {
    id: "1", fingerprint: "f", source: "gupy", sources: ["gupy"], external_id: "1", url: "https://example.com/job",
    apply_url: null, apply_type: "form", title: "Dev Node", company: "Acme", location: "Remoto", remote_scope: "brazil",
    language: "pt", description: null, requirements: null, posted_at: null, first_seen_at: "", last_seen_at: "",
    score: 50, score_reason: "ok", scored_at: null, status: "new", status_reason: null, applied_at: null, cv_used: null,
    ...overrides,
  };
}

describe("digest", () => {
  it("ranks by score and leaves out skipped jobs", () => {
    const jobs = [row({ id: "a", score: 40 }), row({ id: "b", score: 90 }), row({ id: "c", score: 95, status: "skipped" })];
    expect(topJobs(jobs, 15).map((job) => job.id)).toEqual(["b", "a"]);
  });

  it("lists failed boards and escapes job titles", () => {
    const { html } = renderDigest({
      date: "18/11/2026",
      newJobs: [row({ title: "<script>x</script>" })],
      topN: 15,
      cutoff: 70,
      sources: [{ source: "indeed", ok: false, fetched: 0, kept: 0, inserted: 0, error: "HTTP 403" }],
      scoredCount: 1,
      unscoredLeft: 0,
    });
    expect(html).toContain("Fontes que falharam: indeed");
    expect(html).not.toContain("<script>x</script>");
  });
});
