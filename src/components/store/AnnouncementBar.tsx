'use client'

import { useSyncExternalStore, useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useT } from '@/lib/i18n/Provider'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { ANNOUNCEMENT_DISMISS_KEY, ANNOUNCEMENT_ROTATE_MS } from '@/lib/constants'
import type { AnnouncementMessage } from '@/lib/schemas'

// ─── localStorage helpers (mirroring InstallPrompt pattern) ──────────────────

/**
 * Returns the dismissed version stored in localStorage, or null if none.
 * "dismissed" means the customer clicked ✕ on this version of the announcement.
 */
function getDismissedVersion(): number | null {
  try {
    const raw = localStorage.getItem(ANNOUNCEMENT_DISMISS_KEY)
    if (raw === null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function setDismissedVersion(version: number): void {
  try {
    localStorage.setItem(ANNOUNCEMENT_DISMISS_KEY, String(version))
  } catch {}
}

// ─── Hydration-safe localStorage read via useSyncExternalStore ───────────────

const emptySubscribe = () => () => {}

function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

// ─── Contrast helper — white on dark, black on light ─────────────────────────

function contrastFg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  // Perceived luminance (WCAG)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.55 ? '#000000' : '#ffffff'
}

// ─── CSS for the rotating carousel ───────────────────────────────────────────
// Injected once per page via a <style> tag. The keyframes cycle each slide
// through: enter → stay → exit, driven entirely by CSS — no JS timers needed
// during the carousel phase (JS only reads matchMedia once on mount).

function buildRotateStyle(count: number, rotateSec: number): string {
  // Each slide occupies (1/count) of the total cycle.
  // It fades in at 0%, stays until (visible share - transition%), fades out.
  const pct = 100 / count
  const fadePct = Math.min(10, pct * 0.2) // fade = 20% of each slot, max 10 units

  const keyframes = Array.from({ length: count }, (_, i) => {
    const start = i * pct
    const fadeOut = start + pct - fadePct
    const end = start + pct

    // Wrap percentages mod 100 so the last slide exits cleanly
    const cap = (v: number) => Math.min(v, 100)

    return `
  /* slide ${i} */
  @keyframes ann-slide-${i} {
    0%                   { opacity: 0; transform: translateY(100%); }
    ${fadePct.toFixed(1)}%          { opacity: 1; transform: translateY(0); }
    ${cap(fadeOut).toFixed(1)}%  { opacity: 1; transform: translateY(0); }
    ${cap(end).toFixed(1)}%      { opacity: 0; transform: translateY(-100%); }
    100%                 { opacity: 0; transform: translateY(-100%); }
  }`
  }).join('\n')

  const totalSec = rotateSec * count

  const rules = Array.from({ length: count }, (_, i) => {
    const delay = i * rotateSec
    return `
  .ann-slide-${i} {
    animation: ann-slide-${i} ${totalSec}s ${delay}s infinite;
  }`
  }).join('\n')

  return `${keyframes}\n${rules}\n.ann-carousel { position: relative; overflow: hidden; }`
}

// ─── XSS render guard ────────────────────────────────────────────────────────
// Belt-and-suspenders: even if a link somehow passes schema validation, only
// http(s) URLs and root-relative paths may be rendered. javascript:, data:,
// vbscript:, and similar are treated as no-link.

const SAFE_LINK_RE = /^(https?:\/\/|\/)/

function safeLinkOrNull(link: string | undefined): string | null {
  if (!link) return null
  return SAFE_LINK_RE.test(link) ? link : null
}

// ─── Single message render ────────────────────────────────────────────────────

function MessageContent({ msg }: { msg: AnnouncementMessage }) {
  const inner = <span className="text-xs font-medium leading-none">{msg.text}</span>

  const safeLink = safeLinkOrNull(msg.link)
  if (!safeLink) return inner

  // Internal paths: use next/link; external URLs: plain anchor
  if (safeLink.startsWith('/')) {
    return (
      <Link
        href={safeLink}
        prefetch={false}
        className="underline underline-offset-2 hover:opacity-80"
      >
        {inner}
      </Link>
    )
  }

  return (
    <a
      href={safeLink}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:opacity-80"
    >
      {inner}
    </a>
  )
}

// ─── AnnouncementBar ─────────────────────────────────────────────────────────

export function AnnouncementBar() {
  const t = useT()
  const { config } = useStoreConfig()
  const mounted = useHydrated()

  // Dismissal state — read once after mount (hydration-safe)
  const [dismissed, setDismissed] = useState(false)

  // Reduced-motion preference — read once after mount
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (!mounted) return
    const version = config?.announcementVersion ?? 0
    const stored = getDismissedVersion()
    if (stored !== null && stored === version) {
      setDismissed(true)
    }
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia) {
      setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only, config version stabilizes
  }, [mounted])

  // Gate: must be mounted (hydration-safe), enabled, and not dismissed
  if (!mounted) return null
  if (!config?.announcementEnabled) return null
  if (dismissed) return null

  const messages = config.announcementMessages ?? []
  if (messages.length === 0) return null

  const type = config.announcementType ?? 'single'
  const version = config.announcementVersion ?? 0

  // ── Scheduled: check time window ──────────────────────────────────────────
  // NaN guard: if a bound is present but unparseable, treat it as null (open-
  // ended) rather than letting NaN flow into the comparison — NaN comparisons
  // are always false, which would silently drop the guard.
  if (type === 'scheduled') {
    const now = Date.now()
    const startMs = config.announcementStart ? new Date(config.announcementStart).getTime() : null
    const endMs = config.announcementEnd ? new Date(config.announcementEnd).getTime() : null
    const start = startMs !== null && !isNaN(startMs) ? startMs : null
    const end = endMs !== null && !isNaN(endMs) ? endMs : null
    if (start !== null && now < start) return null
    if (end !== null && now > end) return null
  }

  // ── Which messages to show ────────────────────────────────────────────────
  const visibleMessages: AnnouncementMessage[] = type === 'rotating' ? messages : [messages[0]]

  if (visibleMessages.length === 0) return null

  const firstMsg = visibleMessages[0]
  const barBg =
    firstMsg.color && /^#[0-9a-fA-F]{6}$/.test(firstMsg.color) ? firstMsg.color : 'var(--primary)'
  const barFg =
    firstMsg.color && /^#[0-9a-fA-F]{6}$/.test(firstMsg.color)
      ? contrastFg(firstMsg.color)
      : 'var(--primary-foreground)'

  const rotateSec = ANNOUNCEMENT_ROTATE_MS / 1000

  function handleDismiss() {
    setDismissedVersion(version)
    setDismissed(true)
  }

  // ── Rotating carousel ─────────────────────────────────────────────────────
  if (type === 'rotating' && visibleMessages.length > 1 && !reducedMotion) {
    const styleContent = buildRotateStyle(visibleMessages.length, rotateSec)

    return (
      <section
        aria-label={t.store.announcementBar}
        aria-live="off"
        className="relative w-full"
        style={{ backgroundColor: barBg, color: barFg }}
      >
        {/*
          Inline keyframe styles — scoped, no global CSS file needed.
          INVARIANT: only numeric values (count/seconds) are interpolated here.
          Merchant strings (text/link/color) MUST NEVER enter this template;
          color is applied via React style={} props only, never inlined here.
        */}
        <style dangerouslySetInnerHTML={{ __html: styleContent }} />

        <div className="ann-carousel mx-auto flex h-8 max-w-7xl items-center justify-between px-4">
          {/* Carousel slides — each absolutely positioned, CSS-animated */}
          <div className="relative flex-1 overflow-hidden h-full flex items-center">
            {visibleMessages.map((msg, i) => {
              const slideBg = msg.color && /^#[0-9a-fA-F]{6}$/.test(msg.color) ? msg.color : barBg
              const slideFg =
                msg.color && /^#[0-9a-fA-F]{6}$/.test(msg.color) ? contrastFg(msg.color) : barFg
              return (
                <div
                  key={i}
                  className={`ann-slide-${i} absolute inset-0 flex items-center justify-center`}
                  style={{ backgroundColor: slideBg, color: slideFg }}
                  aria-hidden={i !== 0}
                >
                  <MessageContent msg={msg} />
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t.store.dismissAnnouncement}
            className="ms-2 shrink-0 rounded p-1 opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: barFg }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    )
  }

  // ── Single / scheduled / rotating-with-reduced-motion → show first message ─
  return (
    <section
      aria-label={t.store.announcementBar}
      className="relative w-full"
      style={{ backgroundColor: barBg, color: barFg }}
    >
      <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4">
        <div className="flex flex-1 items-center justify-center">
          <MessageContent msg={firstMsg} />
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t.store.dismissAnnouncement}
          className="ms-2 shrink-0 rounded p-1 opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: barFg }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  )
}
