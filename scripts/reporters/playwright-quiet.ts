/**
 * Quiet Playwright reporter — suppresses per-passing-test noise.
 *
 * Default behaviour (no env var):
 *   - Passing tests: silent.
 *   - Failing tests: printed on finish as  ✗ <file> › <test>  + error snippet.
 *   - Live heartbeat: rewriting spinner (TTY) or periodic newline beat (~4s, CI/non-TTY).
 *   - Final line: compact summary (passed / failed / skipped / flaky + duration).
 *
 * Verbose opt-in:
 *   TEST_VERBOSE=1 pnpm exec playwright test   →  falls back to Playwright's built-in 'list' reporter.
 *   (playwright.config.ts handles that switch; this file is only loaded when TEST_VERBOSE is NOT '1'.)
 *
 * Safety contract:
 *   - This reporter ONLY controls printing. It never touches process.exitCode or throws
 *     after Playwright has resolved the run. Playwright owns exit codes entirely.
 *   - Failures are ALWAYS printed — never suppressed. When in doubt, print more.
 */

import type {
  Reporter,
  TestCase,
  TestResult,
  FullConfig,
  Suite,
  FullResult,
} from '@playwright/test/reporter'

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}
const dim = (s: string) => `${C.dim}${s}${C.reset}`
const red = (s: string) => `${C.red}${s}${C.reset}`
const green = (s: string) => `${C.green}${s}${C.reset}`
const bold = (s: string) => `${C.bold}${s}${C.reset}`
const cyan = (s: string) => `${C.cyan}${s}${C.reset}`
const yellow = (s: string) => `${C.yellow}${s}${C.reset}`

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(ms: number): string {
  if (ms >= 60_000) {
    const m = Math.floor(ms / 60_000)
    const s = Math.floor((ms % 60_000) / 1000)
    return s > 0 ? `${m}m${s}s` : `${m}m`
  }
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
}

/** Strip ANSI codes so we can measure display width. */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

/**
 * Shorten an absolute file path to the part relative to cwd, e.g.:
 *   /home/user/project/e2e/cart.spec.ts  →  e2e/cart.spec.ts
 */
function relPath(filePath: string): string {
  const cwd = process.cwd()
  if (filePath.startsWith(cwd + '/')) return filePath.slice(cwd.length + 1)
  if (filePath.startsWith(cwd + '\\')) return filePath.slice(cwd.length + 1)
  return filePath
}

/** Build the full test title including parent suites, e.g. suite > nested > test */
function fullTitle(test: TestCase): string {
  return test.titlePath().filter(Boolean).join(' › ')
}

// ── Reporter implementation ───────────────────────────────────────────────────
interface FailureEntry {
  title: string
  file: string
  errors: Array<{ message?: string; snippet?: string }>
  retries: number
}

export default class PlaywrightQuietReporter implements Reporter {
  private startTime = 0
  private totalTests = 0
  private done = 0
  private passed = 0
  private failed = 0
  private skipped = 0
  private flaky = 0

  private heartbeat: ReturnType<typeof setInterval> | null = null
  private frame = 0
  private readonly SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

  private failures: FailureEntry[] = []

  // ── onBegin ────────────────────────────────────────────────────────────────
  onBegin(_config: FullConfig, suite: Suite): void {
    this.startTime = Date.now()
    this.totalTests = suite.allTests().length

    if (process.stdout.isTTY) {
      this.heartbeat = setInterval(() => this.tick(), 120)
    } else {
      this.heartbeat = setInterval(() => {
        process.stdout.write(
          dim(
            `  … e2e running — ${fmt(Date.now() - this.startTime)}, ${this.done}/${this.totalTests} done\n`,
          ),
        )
      }, 4000)
    }
    this.heartbeat.unref?.()
  }

  private tick(): void {
    const f = this.SPINNER[this.frame++ % this.SPINNER.length]
    const elapsed = fmt(Date.now() - this.startTime)
    const line = `${cyan(f)} ${dim(`e2e… ${elapsed} · ${this.done}/${this.totalTests}`)}`
    process.stdout.write(`\r${line}\x1b[K`)
  }

  // ── onTestEnd ──────────────────────────────────────────────────────────────
  onTestEnd(test: TestCase, result: TestResult): void {
    this.done++

    if (result.status === 'skipped') {
      this.skipped++
      return
    }

    // Playwright marks a test as 'flaky' when it passed on retry after earlier failures.
    // result.status is 'passed' in that case but test.outcome() returns 'flaky'.
    const outcome = test.outcome()
    if (outcome === 'flaky') {
      this.flaky++
      this.passed++
      return
    }

    if (result.status === 'passed') {
      this.passed++
      return
    }

    // failed / timedOut / interrupted
    this.failed++

    const errors = result.errors.map((e) => ({
      message: e.message,
      snippet: e.snippet,
    }))

    this.failures.push({
      title: fullTitle(test),
      file: relPath(test.location.file),
      errors,
      retries: result.retry,
    })
  }

  // ── onError ────────────────────────────────────────────────────────────────
  onError(error: { message?: string; stack?: string }): void {
    this.stopHeartbeat()
    const msg = error.message ?? error.stack ?? 'Unknown error'
    process.stdout.write(`\n${red(bold('ERROR'))} ${msg}\n`)
  }

  // ── onEnd ──────────────────────────────────────────────────────────────────
  onEnd(_result: FullResult): void {
    this.stopHeartbeat()

    const elapsed = Date.now() - this.startTime

    // ── Print failures ──────────────────────────────────────────────────────
    if (this.failures.length > 0) {
      process.stdout.write(`\n${red(bold('FAILURES'))}\n`)
      for (const f of this.failures) {
        process.stdout.write(
          `\n  ${red('✗')} ${cyan(f.file)} ${dim('›')} ${bold(f.title)}` +
            (f.retries > 0 ? dim(` (retried ${f.retries}×)`) : '') +
            '\n',
        )
        for (const err of f.errors) {
          if (err.message) {
            const lines = err.message.split('\n').map((l: string) => `      ${l}`)
            process.stdout.write(lines.join('\n') + '\n')
          }
          if (err.snippet) {
            process.stdout.write(`      ${dim('snippet:')}\n`)
            const lines = err.snippet.split('\n').map((l: string) => `      ${l}`)
            process.stdout.write(lines.join('\n') + '\n')
          }
        }
      }
    }

    // ── Flaky notice ────────────────────────────────────────────────────────
    if (this.flaky > 0) {
      process.stdout.write(
        `\n${yellow(bold('FLAKY'))} ${yellow(`${this.flaky} test${this.flaky === 1 ? '' : 's'} passed on retry`)}\n`,
      )
    }

    // ── Summary line ────────────────────────────────────────────────────────
    const total = this.passed + this.failed + this.skipped
    const testSummary =
      this.failed > 0
        ? `${red(`${this.failed} failed`)}, ${green(`${this.passed} passed`)}${this.skipped > 0 ? `, ${dim(`${this.skipped} skipped`)}` : ''}${this.flaky > 0 ? `, ${yellow(`${this.flaky} flaky`)}` : ''}, ${total} total`
        : `${green(`${this.passed} passed`)}${this.skipped > 0 ? `, ${dim(`${this.skipped} skipped`)}` : ''}${this.flaky > 0 ? `, ${yellow(`${this.flaky} flaky`)}` : ''}, ${total} total`

    const summaryLine = [
      bold('Tests:'),
      testSummary,
      dim('|'),
      bold('Duration:'),
      dim(fmt(elapsed)),
    ].join(' ')

    const width = Math.min(process.stdout.columns ?? 80, stripAnsi(summaryLine).length + 2)
    const divider = dim('─'.repeat(width))

    process.stdout.write(`\n${divider}\n${summaryLine}\n`)
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  private stopHeartbeat(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
    if (process.stdout.isTTY) process.stdout.write('\r\x1b[K')
  }
}
