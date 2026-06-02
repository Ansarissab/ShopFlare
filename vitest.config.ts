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
    environment: 'node',
    include: ['{src,worker}/**/*.{test,spec}.ts'],
  },
})
