import { z } from "zod";
import { createDb, markJob } from "../db/client.js";
import { loadLocalEnv } from "../env.js";

// Usage: npm run marca -- <job-id> <applied|pending_me|failed|skipped|approved> <platform> ["reason"] [cv-file]
loadLocalEnv();
const Args = z.tuple([
  z.string().uuid(),
  z.enum(["applied", "pending_me", "failed", "skipped", "approved"]),
  z.string().min(2),
  z.string().optional(),
  z.string().optional(),
]);

const [id, status, platform, reason, cvUsed] = Args.parse(process.argv.slice(2));
const job = await markJob(createDb(), { id, status, platform, reason, cvUsed });
console.log(`${job.title} @ ${job.company}: ${job.status}${job.status_reason ? ` (${job.status_reason})` : ""}`);
