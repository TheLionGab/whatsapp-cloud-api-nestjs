import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// O Nest depende de decorators + emitDecoratorMetadata para a injeção de
// dependência; o esbuild do Vite não emite metadata, então o SWC transforma.
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        target: "es2022",
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
    env: { LOG_LEVEL: "silent" },
  },
});
