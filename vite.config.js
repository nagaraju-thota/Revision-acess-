import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.{js,jsx}"],
    coverage: {
      provider: "v8",
      // lcov.info is what SonarQube reads (sonar.javascript.lcov.reportPaths)
      reporter: ["text", "text-summary", "lcov", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/index.css"],
      // The test run (and so the CI pipeline) fails if coverage drops below 90%.
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
