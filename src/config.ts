import { readFileSync } from "node:fs";
import { z } from "zod";

const ConfigSchema = z.object({
  keywordsBr: z.array(z.string().min(2)).min(1),
  keywordsIntl: z.array(z.string().min(2)).min(1),
  broadTermsBr: z.array(z.string().min(2)),
  wellfoundRoles: z.array(z.string().min(2)),
  scoreCutoff: z.number().int().min(0).max(100),
  scoringModel: z.string().min(3),
  claudeCommand: z.string().min(1),
  scoringBatchSize: z.number().int().min(1).max(25),
  scoringConcurrency: z.number().int().min(1).max(4),
  maxScoringPerRun: z.number().int().min(0),
  maxDetailFetchesPerSource: z.number().int().min(0),
  dailyApplyLimits: z.record(z.string(), z.number().int().min(0)),
  contactSearchesPerDay: z.number().int().min(0),
  contactsPerCompany: z.number().int().min(1),
});

export type RadarConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(path = "config/radar.config.json"): RadarConfig {
  return ConfigSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}


export function dailyLimitFor(config: RadarConfig, platform: string): number {
  return config.dailyApplyLimits[platform] ?? config.dailyApplyLimits.default ?? 15;
}
