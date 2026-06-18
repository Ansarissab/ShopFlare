# Repo hygiene — stop tracking `graphify-out` (keep it local, remove from GitHub + history)

Status: Proposed. Maintenance task (not a feature phase). Author: requested 2026-06-13.

## Goal

`graphify-out/` (the graphify knowledge-graph build artifact — 2.7 MB, 6 tracked
files) is committed to the repo. It is generated output, not source, so it should
**live only locally** and never reach GitHub. We want to:

1. Keep the directory + files on disk locally (do **not** delete them).
2. Stop tracking it (remove from the index / future commits).
3. Ignore it via `.gitignore`.
4. Optionally purge it from **all git history** so a fresh `git clone` never
   downloads it (the "clear it from the logs completely" ask).

## Scope decisions (read before executing)

| Item | Tracked? | Decision | Why |
| --- | --- | --- | --- |
| `graphify-out/` | yes (6 files, 2.7 MB, 1 commit) | **Remove** (untrack + ignore, optional history purge) | generated build artifact; already matched by `**/graphify-out` in `.gitignore` |
| `.githooks/` | yes (`commit-msg`, `pre-commit`, `pre-push`) | **KEEP — do not remove** | `prepare` runs `git config core.hooksPath .githooks`; the hooks (AI-attribution strip, lint/format/typecheck, pre-push) only work because the dir is in the repo. Removing it breaks the gate on every fresh clone. This is shared infra, not local cruft. |
| `.env.development` | yes | **Verify, then decide** | `.example` templates are fine to track. Confirm `.env.development` contains **no secrets** (CLAUDE.md says secrets live in `.env.local`/CF vars). If it has secrets → add it to Phase B's purge paths and rotate the leaked values. |

Everything else is already clean: no `.DS_Store`, `coverage/`, `test-results/`,
`playwright-report/`, `.next/`, `.open-next/`, `.wrangler/`, `.visual-baselines/`,
or `lighthouse_results/` is tracked.

## Pre-flight

- Tool: **git-filter-repo** is installed (`/usr/local/bin/git-filter-repo`). Do NOT
  use the legacy `git filter-branch` (slow, error-prone, officially discouraged).
- Confirm a clean working tree first (only the intended changes). `git status`.
- **The user performs every `git push`/force-push** (never the agent).

---

## Phase A — Untrack + ignore (safe, reversible, keeps files local)

This removes `graphify-out` from the index and future commits but leaves it on
disk. It does **not** rewrite history (old commits still contain it).

```bash
# 1. .gitignore already has the rule (lines ~70-71):
#      # graphify knowledge graph outputs (cache + generated files)
#      **/graphify-out
#    If that edit is still uncommitted, it gets committed in step 3.

# 2. Untrack the directory WITHOUT deleting it from disk (--cached keeps the files):
git rm -r --cached graphify-out

# 3. Commit the removal + the ignore rule together:
git add .gitignore
git commit -m "chore: stop tracking graphify-out (generated graph output, keep local-only)"

# 4. Sanity: still on disk, no longer tracked, ignored going forward
ls -d graphify-out                 # still present locally
git ls-files graphify-out | wc -l  # -> 0
git check-ignore graphify-out      # -> graphify-out (ignored)
```

Then **user**: `git push`. After this, `graphify-out` disappears from the repo
**tip** (HEAD) — fresh clones won't get it in their working tree. It still exists
in older commits' history (so `clone` still transfers the 2.7 MB during fetch).
For most cases Phase A is enough. Do Phase B only if you specifically want it gone
from history.

## Phase B — Purge from ALL history (optional; destructive; rewrites SHAs)

Only do this if you want `graphify-out` gone from every past commit (smaller
clones, "cleared from the logs"). This **rewrites history** → all commit hashes
after the first occurrence change → requires a **force-push** and anyone else with
a clone must re-clone.

> Note: `graphify-out` appears in only **1** commit, so the rewrite is small and
> low-risk — but it still changes that commit's SHA and every descendant.

### B0. Back up first (the safety net)

```bash
# Full mirror backup so the original history is recoverable no matter what:
git clone --mirror . ../SinglePageEcomm-backup.git
# (or just copy the whole folder). Keep until you've confirmed the rewrite is good.
```

### B1. Run git-filter-repo

git-filter-repo prefers a fresh clone and, by design, drops the `origin` remote
after rewriting (to stop accidental pushes to the wrong place).

```bash
# Recommended: operate on a fresh clone to avoid touching your working repo.
cd ..
git clone SinglePageEcomm SinglePageEcomm-clean
cd SinglePageEcomm-clean

# Remove the path from ALL history:
git filter-repo --path graphify-out --invert-paths
#   ( add more --path <x> --path <y> here if .env.development must also be purged )

# filter-repo removed 'origin' — re-point it at the real GitHub remote:
git remote add origin <git@github.com:USER/REPO.git>   # use your actual remote URL
```

### B2. Verify the purge

```bash
git log --oneline -- graphify-out | wc -l   # -> 0  (gone from all history)
git count-objects -vH                        # repo size should drop
```

### B3. Force-push (USER does this) + re-ignore

```bash
# USER runs (force-with-lease is safer than --force):
git push origin --force-with-lease --all
git push origin --force-with-lease --tags

# Make sure the ignore rule + the local files come along in the cleaned clone:
#   - .gitignore should still contain **/graphify-out (carried by history).
#   - copy your local graphify-out/ working files into the clean clone if you keep
#     working there, OR run filter-repo in-place on the original (see note below).
```

### B-alt. In-place rewrite (if you don't want a second clone)

```bash
# In the original repo (working tree must be clean). Files on disk are preserved
# because graphify-out is gitignored/untracked after Phase A.
git filter-repo --path graphify-out --invert-paths --force
git remote add origin <remote-url>     # filter-repo drops it
# USER: git push origin --force-with-lease --all --tags
```

## Post-purge housekeeping

- Tell any collaborators / other machines to **re-clone** (their old clones have
  the divergent history and will conflict on pull).
- Delete the backup mirror once you've confirmed GitHub looks right and CI passes.
- If GitHub shows the old blob in cached views, it clears after GC / a support
  request; the force-pushed history no longer references it.

## Risks & guardrails

- **History rewrite is irreversible without the backup** — B0 is mandatory.
- **Never let the agent push** — every push/force-push in Phase B is the user's.
- Force-push uses `--force-with-lease` (refuses if the remote moved unexpectedly).
- If `.env.development` turns out to hold real secrets: purging history removes the
  file but **does not un-leak already-pushed secrets** — rotate those credentials.

## Recommendation

- **Do Phase A now** — clean, safe, reversible, solves "don't track it / keep local".
- **Do Phase B only if** you care that the 2.7 MB lives in history. Given it's a
  single non-secret commit, Phase A alone is a perfectly defensible stopping point;
  Phase B is "nice to have," not required.
- **Do not touch `.githooks`** — it must stay tracked for the hook gate to work.
