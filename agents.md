# Agent Orchestration Plan

This file documents how Claude Code uses parallel subagents to build this project.
Referenced by CLAUDE.md for context in future sessions.

## Agent Budget
Maximum 20 parallel agents per session. Use worktree isolation only when agents write to the same files simultaneously.

## Build Phases

### Phase 0 — Foundation (run first, sequential dependency)
1. Project scaffold (Next.js 16 + wrangler + package.json)
2. D1 schema + Drizzle setup
3. globals.css + Tailwind theme + shadcn init

### Phase 1 — Parallel (after Phase 0 complete)
Run all simultaneously:
- Agent A: lib/types + lib/constants + lib/i18n/en.ts + lib/utils
- Agent B: CF Worker skeleton (Hono) + all route stubs
- Agent C: Store layout + navigation + theme provider
- Agent D: Product display components (card, carousel, variant selector)
- Agent E: Cart (Zustand) + localStorage persistence
- Agent F: docs/ structure + cost breakdown docs

### Phase 2 — Parallel (after Phase 1 complete)
- Agent G: Stripe Checkout integration (CF Worker route + client flow)
- Agent H: COD form + address validation + Zod schema
- Agent I: WhatsApp deep link generator + POS screen
- Agent J: Order tracking page (/track/[orderId])
- Agent K: Admin dashboard skeleton + sidebar navigation
- Agent L: Product CRUD admin (with R2 image upload)

### Phase 3 — Parallel (after Phase 2 complete)
- Agent M: Order management admin (status updates, tracking number entry)
- Agent N: Coupon management (D1 + Stripe sync)
- Agent O: Resend email (BCC strategy) + PWA Web Push setup
- Agent P: Reviews/ratings (submit form + admin moderation)
- Agent Q: Notify Me (restock alerts)
- Agent R: Sitemap + robots.txt + JSON-LD structured data

### Phase 4 — Polish (after Phase 3 complete)
- Agent S: Setup wizard CLI (npx create-store using @clack/prompts)
- Agent T: Light/dark mode toggle + PWA manifest + service worker
- Agent U: Security headers (_headers file) + Turnstile integration
- Agent V: Analytics (CF Analytics Engine events) + admin analytics view
- Agent W: Docs completion (all .md files in docs/)

## DRY Rules (enforced across all agents)
- ALL colors via CSS vars in globals.css only
- ALL UI strings via lib/i18n/en.ts only — zero hardcoded strings in components
- ALL TypeScript types inferred from Drizzle schema in db/schema.ts
- ALL validation via Zod schemas in lib/schemas/ — shared client + Worker
- ALL constants in lib/constants/index.ts
- shadcn components in components/ui/ — never duplicate component logic

## Agent Communication Pattern
Agents write to separate file trees where possible.
When overlap exists, use worktree isolation.
Each agent receives: this agents.md + CONTEXT.md + relevant ADRs as context.

## Monitoring
After each phase, audit:
- No hardcoded strings (grep for JSX text not using i18n)
- No duplicate type definitions (all should come from Drizzle inference)
- No secrets in code (grep for sk_live, re_, whsec_)
- DRY violations (duplicate utility functions)
- Missing Turnstile on public forms
