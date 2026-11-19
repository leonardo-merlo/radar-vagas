import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "painel/src/lib/**/*.test.ts"],
  },
});
