import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated build artifacts
    "public/sw.js",
    "public/sw.js.map",
    // Wrangler dev/build bundles (transient generated worker code)
    ".wrangler/**",
    // Test + tooling output (generated, never source)
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".visual-baselines/**",
    "e2e/**/*-snapshots/**",
  ]),
  // Playwright fixtures legitimately call the injected `use()` — not a React Hook.
  {
    files: ["e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
]);

export default eslintConfig;
