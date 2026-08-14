import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/generated/**", "src/app/**"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "react",
          environment: "jsdom",
          include: ["tests/**/*.test.tsx"],
        },
      },
    ],
  },
});
