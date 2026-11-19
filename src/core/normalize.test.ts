import { describe, expect, it } from "vitest";
import { dedupe, fingerprintOf, normalizeJob } from "./normalize.js";
import type { RawJob } from "./types.js";

const base: RawJob = { source: "gupy", externalId: "1", url: "https://x", applyType: "form", title: "Dev", company: "Acme" };

describe("fingerprint", () => {
  it("matches the same job written differently across boards", () => {
    expect(fingerprintOf("Acme Tecnologia LTDA", "Desenvolvedor(a) Full Stack Júnior - Remoto")).toBe(
      fingerprintOf("ACME", "Desenvolvedor Full Stack Junior"),
    );
  });

  it("separates different roles at the same company", () => {
    expect(fingerprintOf("Acme", "Backend Developer")).not.toBe(fingerprintOf("Acme", "Frontend Developer"));
  });
});

describe("dedupe", () => {
  it("merges duplicates and keeps every source", () => {
    const first = normalizeJob({ ...base, title: "Node Developer", remoteFlag: true });
    const second = normalizeJob({ ...base, source: "linkedin", title: "Node Developer - Remote", description: "Node.js" });
    const [merged] = dedupe([first, second]);
    expect(merged?.sources).toEqual(["gupy", "linkedin"]);
    expect(merged?.description).toBe("Node.js");
  });
});
