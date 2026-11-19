import { dailyLimitFor, loadConfig } from "../config.js";
import { appliedTodayByPlatform, applyQueue, createDb } from "../db/client.js";
import { loadLocalEnv } from "../env.js";
import { platformOf } from "./platform.js";

// Prints the apply queue as JSON for the "aplica nas vagas" skill.
// Usage: npm run fila -- [limit] [--cutoff=NN]
loadLocalEnv();
const config = loadConfig();
const limitArg = process.argv.slice(2).find((arg) => /^\d+$/.test(arg));
const cutoffArg = process.argv.find((arg) => arg.startsWith("--cutoff="))?.split("=")[1];
const cutoff = cutoffArg ? Number(cutoffArg) : config.scoreCutoff;

const db = createDb();
const [jobs, appliedToday] = await Promise.all([applyQueue(db, cutoff, Number(limitArg ?? 60)), appliedTodayByPlatform(db)]);

const remaining: Record<string, number> = {};
const queue = jobs.flatMap((job) => {
  const platform = platformOf(job);
  remaining[platform] ??= dailyLimitFor(config, platform) - (appliedToday[platform] ?? 0);
  if ((remaining[platform] ?? 0) <= 0) return [];
  remaining[platform] = (remaining[platform] ?? 0) - 1;
  return [
    {
      id: job.id,
      score: job.score,
      title: job.title,
      company: job.company,
      platform,
      apply_type: job.apply_type,
      url: job.url,
      apply_url: job.apply_url,
      language: job.language,
      status: job.status,
      score_reason: job.score_reason,
      requirements: job.requirements,
      description: job.description?.slice(0, 2500) ?? null,
    },
  ];
});

console.log(JSON.stringify({ cutoff, appliedToday, queue }, null, 2));
