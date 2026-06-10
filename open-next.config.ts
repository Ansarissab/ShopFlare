import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// OpenNext adapter config for the Next.js frontend worker.
// Caching defaults are fine for now; the frontend fetches all data from the
// API worker (NEXT_PUBLIC_WORKER_URL) over HTTP, so no D1/KV/R2 bindings here.
// See https://opennext.js.org/cloudflare/caching to enable ISR/cache later.
export default defineCloudflareConfig()
