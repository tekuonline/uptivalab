import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  outDir: "dist",
  splitting: true,
  sourcemap: false,
  clean: true,
  skipNodeModulesBundle: true,
  // Disable type checking during bundling - rely on separate tsc step
  onSuccess: undefined,
  // Ignore TypeScript errors during bundling
  tsconfig: "tsconfig.json",
});
