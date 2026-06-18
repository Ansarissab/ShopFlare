/**
 * Quiet Vitest reporter — suppresses per-passing-test noise.
 *
 * Default behaviour (no env var):
 *   - Passing tests: silent.
 *   - Failing tests: printed on finish as  ✗ <file> › <test>  + error/diff.
 *   - Final line: one-line summary (files, tests, duration).
 *
 * Verbose opt-in:
 *   VITEST_VERBOSE=1 pnpm test:unit   →  falls back to Vitest's built-in default reporter.
 *   (The config in vitest.config.ts / vitest.integration.config.ts handles that switch;
 *    this file is only loaded when VITEST_VERBOSE is NOT '1'.)
 *
 * Safety contract:
 *   - This reporter ONLY controls printing. It never touches process.exitCode or throws
 *     after Vitest has resolved the run. Vitest owns exit codes entirely.
 *   - Failures are ALWAYS printed — never suppressed. When in doubt, print more.
 */

import type { Reporter, TestCase, TestModule } from 'vitest/node'

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

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

/** Strip ANSI codes so we can measure display width. */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

/**
 * Shorten an absolute file path to the part relative to cwd, e.g.:
 *   /home/user/project/src/lib/utils.test.ts  →  src/lib/utils.test.ts
 */
function relPath(moduleId: string): string {
  const cwd = process.cwd()
  if (moduleId.startsWith(cwd + '/')) return moduleId.slice(cwd.length + 1)
  if (moduleId.startsWith(cwd + '\\')) return moduleId.slice(cwd.length + 1)
  return moduleId
}

/** Collect the full test name including parent suites, e.g.  suite > nested > test */
function fullTestName(testCase: TestCase): string {
  const parts: string[] = []
  let node: TestCase['parent'] | undefined = testCase.parent
  while (node && node.type !== 'module') {
    parts.unshift(node.name)
    node = (node as { parent?: typeof node }).parent
  }
  parts.push(testCase.name)
  return parts.join(' › ')
}

// ── Reporter implementation ───────────────────────────────────────────────────
export default class QuietReporter implements Reporter {
  private startTime = 0
  private filesDone = 0
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private frame = 0
  private readonly SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

  onTestRunStart(): void {
    this.startTime = Date.now()
    // Live progress so the run is visibly underway through EVERY phase — including the
    // long collection phase (no files have finished yet) and when running concurrently
    // with `build` in `pnpm verify`. Without it, a silent parallel run looks dead.
    if (process.stdout.isTTY) {
      // Rewriting spinner on one line:  ⠹ running tests… 12.3s · 42 files
      this.heartbeat = setInterval(() => this.tick(), 120)
    } else {
      // Non-TTY (piped / CI logs): can't rewrite a line, so emit a periodic newline beat.
      this.heartbeat = setInterval(() => {
        process.stdout.write(
          dim(
            `  … running tests — ${fmt(Date.now() - this.startTime)}, ${this.filesDone} files done\n`,
          ),
        )
      }, 4000)
    }
    this.heartbeat.unref?.()
  }

  private tick(): void {
    const f = this.SPINNER[this.frame++ % this.SPINNER.length]
    const n = this.filesDone
    const line = `${cyan(f)} ${dim(`running tests… ${fmt(Date.now() - this.startTime)} · ${n} file${n === 1 ? '' : 's'}`)}`
    // \r to column 0, write, then clear-to-EOL so shorter frames leave no tail.
    process.stdout.write(`\r${line}\x1b[K`)
  }

  /** Count finished files to feed the live progress signal (failures printed at end). */
  onTestModuleEnd(_testModule: TestModule): void {
    this.filesDone++
  }

  /**
   * Called after all test modules have finished. Walk the TestModule tree to
   * collect failures and counters, then print compact output.
   *
   * We use `onTestRunEnd` (the stable Vitest 3.x hook) rather than the
   * deprecated `onFinished`. Vitest calls this after exit-code is already
   * determined, so we can't accidentally influence it.
   */
  onTestRunEnd(testModules: ReadonlyArray<TestModule>): void {
    // Stop the live heartbeat and wipe the spinner line before printing results.
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
    if (process.stdout.isTTY) process.stdout.write('\r\x1b[K')

    const elapsed = Date.now() - this.startTime

    let filesPassed = 0
    let filesFailed = 0
    let testsTotal = 0
    let testsPassed = 0
    let testsFailed = 0
    let testsSkipped = 0

    // Accumulate failures to print after counting.
    const failLines: string[] = []

    for (const mod of testModules) {
      const modState = mod.state()
      if (modState === 'failed') filesFailed++
      else filesPassed++

      for (const test of mod.children.allTests()) {
        const result = test.result()
        if (result.state === 'skipped') {
          testsSkipped++
          continue
        }
        testsTotal++
        if (result.state === 'passed') {
          testsPassed++
        } else if (result.state === 'failed') {
          testsFailed++
          const file = relPath(mod.moduleId)
          const name = fullTestName(test)
          failLines.push(`\n  ${red('✗')} ${cyan(file)} ${dim('›')} ${bold(name)}`)

          // Print each error's message and diff (if present).
          for (const err of result.errors) {
            if (err.message) {
              // Indent each line for readability.
              const msgLines = err.message.split('\n').map((l: string) => `      ${l}`)
              failLines.push(msgLines.join('\n'))
            }
            if (err.diff) {
              failLines.push(`      ${dim('diff:')}`)
              const diffLines = err.diff.split('\n').map((l: string) => `      ${l}`)
              failLines.push(diffLines.join('\n'))
            }
            if (err.stack && !err.message) {
              // Fallback: no message, print raw stack.
              const stackLines = err.stack
                .split('\n')
                .slice(0, 6)
                .map((l: string) => `      ${l}`)
              failLines.push(stackLines.join('\n'))
            }
          }
        }
        // 'pending' shouldn't appear in onTestRunEnd but treat as non-counted.
      }
    }

    // ── Print failures ────────────────────────────────────────────────────────
    if (failLines.length > 0) {
      process.stdout.write(`\n${red(bold('FAILURES'))}${failLines.join('\n')}\n`)
    }

    // ── Print summary line ────────────────────────────────────────────────────
    const totalFiles = filesPassed + filesFailed
    const fileSummary =
      filesFailed > 0
        ? `${red(`${filesFailed} failed`)}, ${green(`${filesPassed} passed`)}, ${totalFiles} total`
        : `${green(`${totalFiles} passed`)}`

    const testSummary =
      testsFailed > 0
        ? `${red(`${testsFailed} failed`)}, ${green(`${testsPassed} passed`)}${testsSkipped > 0 ? `, ${dim(`${testsSkipped} skipped`)}` : ''}, ${testsTotal + testsSkipped} total`
        : `${green(`${testsPassed} passed`)}${testsSkipped > 0 ? `, ${dim(`${testsSkipped} skipped`)}` : ''}, ${testsTotal + testsSkipped} total`

    const summaryLine = [
      bold('Test Files:'),
      fileSummary,
      dim('|'),
      bold('Tests:'),
      testSummary,
      dim('|'),
      bold('Duration:'),
      dim(fmt(elapsed)),
    ].join(' ')

    // Divider width based on terminal or fallback.
    const width = Math.min(process.stdout.columns ?? 80, stripAnsi(summaryLine).length + 2)
    const divider = dim('─'.repeat(width))

    process.stdout.write(`\n${divider}\n${summaryLine}\n`)
  }
}
