import { describe, expect, it } from "vitest";
import { likePattern, parseFilters, periodStart, toSearch } from "./filters";

describe("dashboard filters", () => {
  it("falls back to defaults for unknown values", () => {
    const filters = parseFilters({ status: "hacked", fonte: "x", nota: "abc", pagina: "-2" });
    expect(filters).toMatchObject({ status: "abertas", source: "todas", minScore: 0, page: 1 });
  });

  it("reads the filters the form sends", () => {
    const filters = parseFilters({ remota: "europe", idioma: "en", fonte: "gupy", nota: "75", local: " Lisboa " });
    expect(filters).toMatchObject({ scope: "europe", language: "en", source: "gupy", minScore: 75, location: "Lisboa" });
  });

  it("round-trips through the query string without default values", () => {
    const filters = parseFilters({ idioma: "pt", pagina: "3" });
    expect(toSearch(filters)).toBe("?idioma=pt&pagina=3");
  });
});

describe("periodStart", () => {
  it("starts today at midnight in São Paulo", () => {
    expect(periodStart("1", new Date("2026-11-18T15:00:00Z"))).toBe("2026-11-18T03:00:00.000Z");
  });

  it("returns undefined for the whole history", () => {
    expect(periodStart("todos")).toBeUndefined();
  });
});

describe("likePattern", () => {
  it("strips characters that would break a PostgREST or-filter", () => {
    expect(likePattern("node,(react)%")).toBe("%node  react%");
  });
});
