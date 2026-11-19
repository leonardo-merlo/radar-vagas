import { describe, expect, it } from "vitest";
import { parseClaudeOutput } from "./score.js";

const result = { id: "a", score: 80, reason: "ok", requirements: ["Node.js"], language: "en", seniority: "junior", eligibleFromBrazil: true };

describe("parseClaudeOutput", () => {
  it("reads structured_output from claude -p --output-format json", () => {
    const stdout = JSON.stringify({ is_error: false, structured_output: { results: [result] } });
    expect(parseClaudeOutput(stdout, ["a"])).toEqual([result]);
  });

  it("drops ids that were not in the batch", () => {
    const stdout = JSON.stringify({ is_error: false, structured_output: { results: [result, { ...result, id: "zzz" }] } });
    expect(parseClaudeOutput(stdout, ["a"])?.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("returns undefined for an error run or a malformed answer", () => {
    expect(parseClaudeOutput(JSON.stringify({ is_error: true }), ["a"])).toBeUndefined();
    expect(parseClaudeOutput("not json", ["a"])).toBeUndefined();
  });
});

describe("OUTPUT_JSON_SCHEMA", () => {
  it("has no $schema URI, which claude --json-schema rejects", async () => {
    const { OUTPUT_JSON_SCHEMA } = await import("./score.js");
    expect(JSON.parse(OUTPUT_JSON_SCHEMA)).not.toHaveProperty("$schema");
  });
});
