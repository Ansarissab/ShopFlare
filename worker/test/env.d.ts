// Type augmentation for the cloudflare:test module — gives `env` in tests the
// real worker Bindings plus the injected TEST_MIGRATIONS migration set.
import type { D1Migration } from '@cloudflare/vitest-pool-workers/config'
import type { Bindings } from 'worker/types'

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Bindings {
    TEST_MIGRATIONS: D1Migration[]
  }
}
