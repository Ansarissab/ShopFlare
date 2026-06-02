/**
 * SinglePageEcomm — interactive setup wizard.
 *
 * Automates the CLI-driven half of docs/setup/cloudflare-guide.md:
 *   prerequisites → CF login → create D1/KV/R2 → patch wrangler.toml →
 *   migrate + seed → worker secrets → deploy worker → write .env.local.
 *
 * Dashboard-only steps (Pages, CF Access, Stripe webhook) are printed at the
 * end with pointers back to the guide — they can't be scripted.
 *
 * Run via `pnpm setup`. Plain TS (type annotations only) so Node's built-in
 * type stripping runs it with no extra dependency. ESM (.mts) because
 * @clack/prompts is ESM-only and the repo defaults to CommonJS.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  intro,
  outro,
  text,
  password,
  confirm,
  isCancel,
  cancel,
  spinner,
  note,
  log,
} from "@clack/prompts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WRANGLER_TOML = resolve(ROOT, "wrangler.toml");
const ENV_LOCAL = resolve(ROOT, ".env.local");
const PLACEHOLDER = "placeholder-replace-after-cf-setup";

// ── shell helpers ──────────────────────────────────────────────────────────

/** Run a command, capturing stdout. Throws on non-zero exit. */
function capture(cmd: string, args: string[], stdin?: string): string {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    input: stdin,
  });
  if (res.status !== 0) {
    throw new Error(
      `\`${cmd} ${args.join(" ")}\` failed (exit ${res.status}):\n` +
        `${res.stderr || res.stdout || res.error?.message || ""}`,
    );
  }
  return res.stdout ?? "";
}

/** Run a command with inherited stdio (user sees live output). */
function runLive(cmd: string, args: string[], stdin?: string): boolean {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: stdin === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
    input: stdin,
  });
  return res.status === 0;
}

/** True if a command exists and exits 0 for the given probe args. */
function probe(cmd: string, args: string[]): boolean {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8" });
  return res.status === 0;
}

/** Abort the wizard cleanly when the user hits Ctrl-C / Esc. */
function guard<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Setup cancelled. Re-run `pnpm setup` any time.");
    process.exit(0);
  }
  return value as T;
}

/**
 * Pulls a resource id out of wrangler's create output. Prefers the precise
 * `<key> = "<id>"` TOML line wrangler v4 prints (so KV's `id = "…"` can't be
 * confused with an unrelated 32-hex token earlier in the output); falls back to
 * the first bare 32-hex run for older formats. The `\b` before the key stops
 * `id` from matching inside `database_id`.
 */
function extractId(output: string, key: "database_id" | "id"): string | null {
  const keyed = output.match(new RegExp(`\\b${key}\\s*=\\s*"([0-9a-f-]{32,})"`, "i"));
  if (keyed) return keyed[1];
  return output.match(/[0-9a-f]{32}/i)?.[0] ?? null;
}

/** Replace `key = "<placeholder>"` in wrangler.toml with a real id. */
function patchToml(key: "database_id" | "id", value: string): void {
  const toml = readFileSync(WRANGLER_TOML, "utf8");
  const re = new RegExp(`(${key}\\s*=\\s*")${PLACEHOLDER}(")`);
  if (!re.test(toml)) {
    log.warn(`Could not find ${key} placeholder in wrangler.toml — set it manually.`);
    return;
  }
  writeFileSync(WRANGLER_TOML, toml.replace(re, `$1${value}$2`));
}

// ── secret + env definitions ────────────────────────────────────────────────

type SecretSpec = {
  name: string;
  label: string;
  masked: boolean;
  required: boolean;
  hint?: string;
};

// Worker secrets — mirrors the Bindings type in worker/types.ts.
const SECRETS: SecretSpec[] = [
  { name: "STRIPE_SECRET_KEY", label: "Stripe secret key (sk_…)", masked: true, required: true },
  { name: "STRIPE_PUBLISHABLE_KEY", label: "Stripe publishable key (pk_…)", masked: false, required: true },
  { name: "STRIPE_WEBHOOK_SECRET", label: "Stripe webhook signing secret (whsec_…)", masked: true, required: false, hint: "Created in Stripe step 9 — skip for now, set later." },
  { name: "RESEND_API_KEY", label: "Resend API key (re_…)", masked: true, required: true },
  { name: "VAPID_PUBLIC_KEY", label: "Web Push VAPID public key", masked: false, required: false, hint: "Generate with: npx web-push generate-vapid-keys" },
  { name: "VAPID_PRIVATE_KEY", label: "Web Push VAPID private key", masked: true, required: false },
  { name: "TURNSTILE_SITE_KEY", label: "Turnstile site key (0x…)", masked: false, required: true },
  { name: "TURNSTILE_SECRET_KEY", label: "Turnstile secret key", masked: true, required: true },
];

// ── wizard ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  intro("SinglePageEcomm — setup wizard");
  note(
    "This drives the CLI half of docs/setup/cloudflare-guide.md.\n" +
      "Nothing is changed until each step asks you to confirm.",
    "What this does",
  );

  // 1 ── Prerequisites ───────────────────────────────────────────────────────
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) {
    log.error(`Node ${process.versions.node} detected — Node 22+ required.`);
    process.exit(1);
  }
  if (!probe("npx", ["wrangler", "--version"])) {
    log.error("wrangler not available. Run `pnpm install` first.");
    process.exit(1);
  }
  log.success(`Node ${process.versions.node} + wrangler ready.`);

  // 2 ── Cloudflare auth ─────────────────────────────────────────────────────
  if (!probe("npx", ["wrangler", "whoami"])) {
    const doLogin = guard(
      await confirm({ message: "Not logged in to Cloudflare. Log in now?" }),
    );
    if (!doLogin) {
      log.warn("Cloudflare login required. Re-run after `npx wrangler login`.");
      process.exit(0);
    }
    if (!runLive("npx", ["wrangler", "login"])) {
      log.error("Login failed.");
      process.exit(1);
    }
  }
  log.success("Cloudflare account authenticated.");

  // 3 ── Provision D1 / KV / R2 ──────────────────────────────────────────────
  const provision = guard(
    await confirm({ message: "Create D1 database, KV namespace, and R2 bucket?" }),
  );
  if (provision) {
    const s = spinner();

    s.start("Creating D1 database `store-db`");
    try {
      const out = capture("npx", ["wrangler", "d1", "create", "store-db"]);
      const id = extractId(out, "database_id");
      if (id) {
        patchToml("database_id", id);
        s.stop(`D1 created → ${id}`);
      } else {
        s.stop("D1 create ran but no id parsed — check wrangler.toml.");
      }
    } catch (e) {
      s.stop("D1 step skipped.");
      log.warn(`${(e as Error).message}\n(If it already exists, paste its id into wrangler.toml.)`);
    }

    s.start("Creating KV namespace `STORE_KV`");
    try {
      const out = capture("npx", ["wrangler", "kv", "namespace", "create", "STORE_KV"]);
      const id = extractId(out, "id");
      if (id) {
        patchToml("id", id);
        s.stop(`KV created → ${id}`);
      } else {
        s.stop("KV create ran but no id parsed — check wrangler.toml.");
      }
    } catch (e) {
      s.stop("KV step skipped.");
      log.warn(`${(e as Error).message}\n(If it already exists, paste its id into wrangler.toml.)`);
    }

    s.start("Creating R2 bucket `store-images`");
    try {
      capture("npx", ["wrangler", "r2", "bucket", "create", "store-images"]);
      s.stop("R2 bucket created.");
    } catch {
      s.stop("R2 step skipped (may already exist).");
    }
  }

  // 4 ── Migrate + seed remote D1 ────────────────────────────────────────────
  const migrate = guard(
    await confirm({ message: "Apply migrations and seed defaults to remote D1?" }),
  );
  if (migrate) {
    log.step("Applying migrations…");
    runLive("pnpm", ["db:migrate"]);
    log.step("Seeding store_config defaults…");
    runLive("pnpm", ["db:seed"]);
    log.success("Database ready.");
  }

  // 5 ── Worker secrets ──────────────────────────────────────────────────────
  const setSecrets = guard(
    await confirm({ message: "Set worker secrets now?" }),
  );
  let turnstileSiteKey = "";
  if (setSecrets) {
    for (const spec of SECRETS) {
      if (spec.hint) log.info(spec.hint);
      const value = guard(
        spec.masked
          ? await password({ message: spec.label })
          : await text({
              message: spec.label,
              placeholder: spec.required ? "required" : "leave blank to skip",
            }),
      );
      const v = (value ?? "").trim();
      if (!v) {
        if (spec.required) log.warn(`${spec.name} left blank — set later via \`npx wrangler secret put ${spec.name}\`.`);
        continue;
      }
      if (spec.name === "TURNSTILE_SITE_KEY") turnstileSiteKey = v;
      const ok = runLive("npx", ["wrangler", "secret", "put", spec.name], v + "\n");
      if (ok) log.success(`${spec.name} set.`);
      else log.warn(`${spec.name} failed — retry with \`npx wrangler secret put ${spec.name}\`.`);
    }
  }

  // FRONTEND_URL is both a worker secret (CORS/redirects) and the Pages origin.
  const frontendUrl = (guard(
    await text({
      message: "Pages site URL (FRONTEND_URL, e.g. https://yourstore.pages.dev)",
      placeholder: "https://yourstore.pages.dev",
    }),
  ) ?? "").trim();
  if (frontendUrl) {
    if (runLive("npx", ["wrangler", "secret", "put", "FRONTEND_URL"], frontendUrl + "\n")) {
      log.success("FRONTEND_URL set.");
    }
  }

  // 6 ── Deploy worker ───────────────────────────────────────────────────────
  // Capture (not inherit) so we can parse the printed *.workers.dev URL. We do
  // NOT re-emit the full deploy output — it can contain binding/account detail
  // that would otherwise land in terminal scrollback / CI logs. Only the parsed
  // URL is surfaced.
  let workerUrl = "";
  const deploy = guard(await confirm({ message: "Deploy the worker now?" }));
  if (deploy) {
    const s = spinner();
    s.start("Deploying worker (ENVIRONMENT=production)");
    try {
      const out = capture("pnpm", ["worker:deploy"]);
      workerUrl = out.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0] ?? "";
      s.stop(workerUrl ? `Worker deployed → ${workerUrl}` : "Worker deployed.");
    } catch (e) {
      s.stop("Deploy failed.");
      log.warn((e as Error).message);
    }
  }
  if (!workerUrl) {
    workerUrl = (guard(
      await text({
        message: "Worker URL (NEXT_PUBLIC_WORKER_URL)",
        placeholder: "https://singlepage-ecomm-worker.YOUR.workers.dev",
      }),
    ) ?? "").trim();
  }

  // 7 ── Write .env.local ────────────────────────────────────────────────────
  const writeEnv = !existsSync(ENV_LOCAL)
    ? true
    : guard(await confirm({ message: ".env.local exists — overwrite?" }));
  if (writeEnv) {
    const siteUrl = frontendUrl || workerUrl;
    const env =
      `# Generated by \`pnpm setup\`. Safe to edit.\n` +
      `NEXT_PUBLIC_WORKER_URL=${workerUrl}\n` +
      `NEXT_PUBLIC_TURNSTILE_SITE_KEY=${turnstileSiteKey}\n` +
      `NEXT_PUBLIC_SITE_URL=${siteUrl}\n`;
    writeFileSync(ENV_LOCAL, env);
    log.success(".env.local written.");
  }

  // 8 ── Remaining manual steps ──────────────────────────────────────────────
  note(
    [
      "1. Connect the repo in Cloudflare Pages (build: `pnpm build`, output: `out`).",
      "2. Protect /admin and /api/admin* with CF Access (guide steps 8a/8b),",
      "   then `wrangler secret put CF_ACCESS_AUD` + `CF_ACCESS_TEAM_DOMAIN`.",
      "3. Add the Stripe webhook → /api/stripe/webhook, then set STRIPE_WEBHOOK_SECRET.",
      "",
      "Full details: docs/setup/cloudflare-guide.md",
    ].join("\n"),
    "Finish in the dashboard",
  );

  outro("Setup complete. Run `pnpm dev` + `pnpm worker:dev` to develop locally.");
}

main().catch((err) => {
  log.error((err as Error).message);
  process.exit(1);
});
