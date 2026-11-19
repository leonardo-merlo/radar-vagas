import type { JobRow } from "../db/database.types.js";

/** Platform used for daily limits: what account or channel the application goes through. */
export function platformOf(job: Pick<JobRow, "source" | "apply_type">): string {
  if (job.apply_type === "email") return "email";
  if (job.apply_type === "external") return "external";
  return job.source;
}
