import { describe, expect, it } from "vitest";
import { normalizeJob } from "../core/normalize.js";
import type { RawJob } from "../core/types.js";
import { applyQueue, appliedTodayByPlatform, createDb, jobById, markJob, saveContacts, saveScore, upsertJobs } from "./client.js";

const raw: RawJob = { source: "gupy", externalId: "1", url: "https://x/1", applyType: "form", title: "Dev Node Júnior", company: "Acme", remoteFlag: true };

describe("upsertJobs", () => {
  it("stores a job seen on two boards once, with both sources", () => {
    const db = createDb(":memory:");
    upsertJobs(db, [normalizeJob(raw)]);
    const { insertedIds } = upsertJobs(db, [normalizeJob({ ...raw, source: "linkedin", applyType: "easy_apply" })]);
    const total = db.prepare("select count(*) as total, max(sources) as sources from jobs").get();
    expect(insertedIds).toEqual([]);
    expect(total).toMatchObject({ total: 1, sources: '["gupy","linkedin"]' });
  });
});

describe("apply queue", () => {
  it("lists approved jobs and new jobs above the cutoff, approved first", () => {
    const db = createDb(":memory:");
    const [low, high, approved] = upsertJobs(db, [
      normalizeJob({ ...raw, title: "A" }),
      normalizeJob({ ...raw, title: "B" }),
      normalizeJob({ ...raw, title: "C" }),
    ]).insertedIds as [string, string, string];
    saveScore(db, low, { score: 40, reason: "", requirements: [], language: "pt" });
    saveScore(db, high, { score: 90, reason: "", requirements: [], language: "pt" });
    markJob(db, { id: approved, status: "approved", platform: "gupy" });
    expect(applyQueue(db, 70, 10).map((job) => job.title)).toEqual(["C", "B"]);
  });

  it("skips jobs Claude marks as not open to Brazil", () => {
    const db = createDb(":memory:");
    const [id] = upsertJobs(db, [normalizeJob(raw)]).insertedIds as [string];
    saveScore(db, id, { score: 5, reason: "US only", requirements: ["Node.js"], language: "en", skipReason: "local" });
    expect(jobById(db, id)).toMatchObject({ status: "skipped", requirements: ["Node.js"] });
  });

  it("counts today's applications per platform", () => {
    const db = createDb(":memory:");
    const [id] = upsertJobs(db, [normalizeJob(raw)]).insertedIds as [string];
    markJob(db, { id, status: "applied", platform: "gupy", cvUsed: "cv.pdf" });
    expect(appliedTodayByPlatform(db)).toEqual({ gupy: 1 });
  });
});

describe("saveContacts", () => {
  it("marks every job of the company as searched, even with no contacts", () => {
    const db = createDb(":memory:");
    const [first, second] = upsertJobs(db, [normalizeJob({ ...raw, title: "A" }), normalizeJob({ ...raw, title: "B" })]).insertedIds as [string, string];
    saveContacts(db, jobById(db, first), []);
    expect(jobById(db, second).contacts_searched_at).not.toBeNull();
  });
});

describe("seniority", () => {
  it("stores the level read from the title", () => {
    const db = createDb(":memory:");
    const [id] = upsertJobs(db, [normalizeJob({ ...raw, title: "Desenvolvedor Pleno" })]).insertedIds as [string];
    expect(jobById(db, id).seniority).toBe("pleno");
  });

  it("takes Claude's level only when the rules found none", () => {
    const db = createDb(":memory:");
    const [undefinedLevel, junior] = upsertJobs(db, [normalizeJob({ ...raw, title: "Full Stack Dev" }), normalizeJob({ ...raw, title: "Dev Jr" })]).insertedIds as [string, string];
    for (const id of [undefinedLevel, junior]) saveScore(db, id, { score: 50, reason: "", requirements: [], language: "pt", seniority: "senior" });
    expect([jobById(db, undefinedLevel).seniority, jobById(db, junior).seniority]).toEqual(["senior", "junior"]);
  });
});
