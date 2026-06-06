import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Mirror the tsconfig path aliases so worker + src modules resolve in tests.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': r('./src'),
      worker: r('./worker'),
    },
  },
  test: {
    name: 'unit',
    // Default to node (fast, no DOM). Component tests opt into jsdom per-file via
    // a `@vitest-environment jsdom` docblock — only the `.tsx` files pay for it.
    environment: 'node',
    include: ['{src,worker}/**/*.{test,spec}.{ts,tsx}'],
    // Integration tests run in the workers pool (vitest.integration.config.ts),
    // not the node pool — keep them out of the unit project.
    exclude: ['worker/test/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8' as const,
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
      exclude: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.config.*',
        '**/types/**',
        'e2e/**',
        '.next/**',
        '**/node_modules/**',
        'src/components/ui/**',
        'worker/db/schema.ts',
        'worker/db/migrations/**',
        'src/app/**/*.tsx',
        'src/middleware.ts',
      ],
    },
  },
})
