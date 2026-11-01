import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["ts/index.ts"],
  format: ["esm", "cjs"],
  // Node.js / ブラウザ / Deno / Bun のいずれでも動くよう、特定環境の組込みに依存しない。
  platform: "neutral",
  target: "es2022",
  outDir: "dist",
  dts: true,
  clean: true,
  sourcemap: false,
});
