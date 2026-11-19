import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { loadConfig, type RadarConfig } from "./config.js";
import { eligibility } from "./core/location.js";
import { dedupe, normalizeJob } from "./core/normalize.js";
import type { NormalizedJob, Source, SourceContext } from "./core/types.js";
import { countUnscored, createDb, jobsByIds, recordSourceRun, saveScore, unscoredJobs, upsertJobs, type RadarDb } from "./db/client.js";
import { createScorer } from "./scoring/score.js";
import { SOURCES } from "./sources/index.js";

// Usage: npm run radar -- [--dry-run] [--no-score] [--score-only] [--source=gupy]
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const skipScoring = args.has("--no-score");
const scoreOnly = args.has("--score-only");
const onlySource = process.argv.find((arg) => arg.startsWith("--source="))?.split("=")[1];

interface SourceSummary {
  source: string;
  ok: boolean;
  fetched: number;
  kept: number;
  inserted: number;
  error?: string;
  durationMs: number;
}

interface Collected {
  summary: SourceSummary;
  jobs: NormalizedJob[];
}

async function collect(source: Source, shared: Omit<SourceContext, "warnings">): Promise<Collected> {
  const started = Date.now();
  const context: SourceContext = { ...shared, warnings: [] };
  try {
    const raw = await source.fetchJobs(context);
    if (raw.length === 0 && context.warnings.length > 0) throw new Error(context.warnings[0]);
    const partial = context.warnings.length > 0 ? `parcial: ${context.warnings.length} falhas (ex.: ${context.warnings[0]})` : undefined;
    const kept = raw.filter((job) => eligibility(job) !== "excluded").map(normalizeJob);
    return {
      summary: { source: source.name, ok: true, fetched: raw.length, kept: kept.length, inserted: 0, error: partial?.slice(0, 300), durationMs: Date.now() - started },
      jobs: kept,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      summary: { source: source.name, ok: false, fetched: 0, kept: 0, inserted: 0, error: message.slice(0, 300), durationMs: Date.now() - started },
      jobs: [],
    };
  }
}

async function collectAll(config: RadarConfig, db: RadarDb | undefined): Promise<void> {
  const context: Omit<SourceContext, "warnings"> = {
    keywordsBr: config.keywordsBr,
    broadTermsBr: config.broadTermsBr,
    keywordsIntl: config.keywordsIntl,
    wellfoundRoles: config.wellfoundRoles,
    maxDetailFetches: config.maxDetailFetchesPerSource,
  };
  const sources = onlySource ? SOURCES.filter((source) => source.name === onlySource) : SOURCES;
  const collected = await Promise.all(sources.map((source) => collect(source, context)));
  const unique = dedupe(collected.flatMap((entry) => entry.jobs));

  if (!db) {
    writeFileSync("dry-run.json", JSON.stringify(unique, null, 2));
    for (const { summary } of collected) printSummary(summary);
    console.log(`Total após deduplicar: ${unique.length}. Modo teste: nada gravado. Amostra em dry-run.json`);
    return;
  }

  const runId = randomUUID();
  const { insertedIds } = upsertJobs(db, unique);
  const insertedBySource = new Map<string, number>();
  for (const job of jobsByIds(db, insertedIds)) insertedBySource.set(job.source, (insertedBySource.get(job.source) ?? 0) + 1);
  for (const { summary } of collected) {
    summary.inserted = insertedBySource.get(summary.source) ?? 0;
    recordSourceRun(db, { runId, ...summary });
    printSummary(summary);
  }
  console.log(`Total após deduplicar: ${unique.length} · novas: ${insertedIds.length}`);
}

function printSummary(summary: SourceSummary): void {
  console.log(
    `${summary.ok ? "ok   " : "FALHA"} ${summary.source.padEnd(15)} coletadas=${summary.fetched} mantidas=${summary.kept} novas=${summary.inserted} ${summary.error ?? ""}`,
  );
}

async function scorePending(config: RadarConfig, db: RadarDb): Promise<void> {
  const pending = unscoredJobs(db, config.maxScoringPerRun);
  if (pending.length === 0) {
    console.log("Nenhuma vaga sem nota.");
    return;
  }
  const scorer = createScorer(config);
  const batches: (typeof pending)[] = [];
  for (let start = 0; start < pending.length; start += config.scoringBatchSize) {
    batches.push(pending.slice(start, start + config.scoringBatchSize));
  }

  let scored = 0;
  let failedBatches = 0;
  async function worker(): Promise<void> {
    for (let batch = batches.shift(); batch; batch = batches.shift()) {
      try {
        for (const result of await scorer.scoreBatch(batch)) {
          saveScore(db, result.id, {
            score: result.score,
            reason: result.reason,
            requirements: result.requirements,
            language: result.language === "other" ? null : result.language,
            skipReason: result.eligibleFromBrazil ? undefined : "Restrição de local (não aceita Brasil/LATAM/UE)",
          });
          scored++;
        }
        console.log(`Notas: ${scored}/${pending.length}`);
      } catch (error) {
        failedBatches++;
        console.error(`Lote de notas falhou: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: config.scoringConcurrency }, worker));
  console.log(`Avaliadas: ${scored}/${pending.length}${failedBatches ? ` · ${failedBatches} lotes falharam` : ""} · sem nota no banco: ${countUnscored(db)}`);
}

async function main(): Promise<void> {
  const config = loadConfig();
  if (dryRun) {
    await collectAll(config, undefined);
    return;
  }
  const db = createDb();
  try {
    if (!scoreOnly) await collectAll(config, db);
    if (!skipScoring) await scorePending(config, db);
    console.log("Abra o painel: npm run painel → http://localhost:3000");
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
