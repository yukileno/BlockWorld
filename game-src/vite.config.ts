import { resolve } from "path";
import { defineConfig } from "vitest/config";

// ブロックワールドは BlockWorld/play/ に置く。相対パス ("./") でビルドするので、
// どこに置いても動く。
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
  },
  worker: {
    format: "es",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
