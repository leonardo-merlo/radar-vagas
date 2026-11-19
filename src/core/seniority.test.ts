import { describe, expect, it } from "vitest";
import { detectSeniority } from "./seniority.js";

describe("detectSeniority from the title", () => {
  it("reads Portuguese and English level words", () => {
    expect(detectSeniority("Desenvolvedor Back-end Jr.")).toBe("junior");
    expect(detectSeniority("Desenvolvedor(a) Full Stack Pleno")).toBe("pleno");
    expect(detectSeniority("Senior Software Engineer")).toBe("senior");
  });

  it("treats trainee, internship and lead as junior or senior", () => {
    expect(detectSeniority("Trainee Desenvolvimento")).toBe("junior");
    expect(detectSeniority("Tech Lead Node.js")).toBe("senior");
  });

  it("keeps the lower level when the title names two", () => {
    expect(detectSeniority("Desenvolvedor(a) Full Stack Júnior/Pleno")).toBe("junior");
  });

  it("reads roman numerals in titles", () => {
    expect(detectSeniority("Software Engineer II")).toBe("pleno");
  });
});

describe("detectSeniority fallbacks", () => {
  it("uses the board's level field when the title has none", () => {
    expect(detectSeniority("Full Stack Developer", "Entry-level")).toBe("junior");
  });

  it("reads an explicit level in the description", () => {
    expect(detectSeniority("Desenvolvedor Node", undefined, "Requisitos. Nível: pleno. Remoto.")).toBe("pleno");
  });

  it("returns nao_definido when nothing says the level", () => {
    expect(detectSeniority("Full Stack Developer", undefined, "We build software.")).toBe("nao_definido");
  });
});

describe("detectSeniority false positives", () => {
  it("does not read a stray I (as in T.I) as a level", () => {
    expect(detectSeniority("Analista de T.I - Suporte")).toBe("nao_definido");
  });
});
