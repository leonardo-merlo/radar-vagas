import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function body(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/^(\/\/.*\n)+/, "");
}

describe("shared database types", () => {
  it("keeps the dashboard copy identical to the radar's", () => {
    expect(body("painel/src/lib/database.types.ts")).toBe(body("src/db/database.types.ts"));
  });
});
