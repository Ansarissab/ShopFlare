// Shared e2e auth constants. The e2e API worker is booted (see playwright.config.ts
// webServer) with these as `--var`, so admin login is deterministic and
// self-contained — no real secrets, no .dev.vars dependency, reproducible anywhere.
export const E2E_ADMIN_PASSWORD = 'e2e-admin-password'
export const E2E_ADMIN_SESSION_SECRET = 'e2e-session-secret-key-do-not-use-in-prod'

// Local API worker (wrangler dev). The frontend talks to it on this fixed port.
export const WORKER_URL = 'http://localhost:8787'

// localStorage key the AdminShell reads to decide "logged in" (mirrors lib/api.ts).
export const ADMIN_TOKEN_KEY = 'shopflare_admin_token'

// Where auth.setup.ts saves the logged-in storageState; admin specs reuse it.
// Under .playwright/ which is gitignored.
export const ADMIN_STORAGE_STATE = '.playwright/auth/admin.json'
