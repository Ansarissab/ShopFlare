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
    environment: 'node',
    include: ['{src,worker}/**/*.{test,spec}.ts'],
    // Integration tests run in the workers pool (vitest.integration.config.ts),
    // not the node pool — keep them out of the unit project.
    exclude: ['worker/test/**', '**/node_modules/**'],
  },
})
