import { existsSync } from "node:fs";

/** Loads .env for local runs; in GitHub Actions the variables come from repository secrets. */
export function loadLocalEnv(): void {
  if (existsSync(".env")) process.loadEnvFile(".env");
}
