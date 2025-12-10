import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      reporter: ["text", "json", "html"],
      provider: "v8",
      lines: 0.8,
      functions: 0.8,
      statements: 0.8,
    },
  },
});
