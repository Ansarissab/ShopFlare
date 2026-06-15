// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MarketingScripts } from './MarketingScripts'

// ── next/script stub ──────────────────────────────────────────────────────────
// next/script is not available in jsdom — stub it to render a <script> tag so
// tests can assert on the presence/absence of script elements by their id prop.
vi.mock('next/script', () => ({
  default: (props: {
    id?: string
    src?: string
    strategy?: string
    dangerouslySetInnerHTML?: { __html: string }
  }) => {
    if (props.src) {
      // Render a plain (non-async) <script> so React 19 does NOT hoist it to
      // <head> — hoisted scripts survive cleanup() and leak across tests.
      // eslint-disable-next-line @next/next/no-sync-scripts
      return <script id={props.id} src={props.src} data-strategy={props.strategy} />
    }
    return (
      <script
        id={props.id}
        data-strategy={props.strategy}
        dangerouslySetInnerHTML={props.dangerouslySetInnerHTML}
      />
    )
  },
}))

// ── useConsent mock ───────────────────────────────────────────────────────────
// Control consent state per test without mounting a real ConsentProvider.
let mockConsented: boolean | null = null

vi.mock('@/lib/consent/ConsentProvider', () => ({
  // Export real ConsentProvider as a pass-through (not used in these tests)
  ConsentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useConsent: () => ({
    consented: mockConsented,
    ready: true,
    accept: vi.fn(),
    decline: vi.fn(),
  }),
}))

// ── helpers ───────────────────────────────────────────────────────────────────

const GA4_ID = 'G-TESTXXXXX'
const ADS_ID = 'AW-TESTXXXXX'
const PIXEL_ID = '1234567890'

function renderScripts(
  overrides: Partial<{
    ga4Id: string
    googleAdsId: string
    metaPixelId: string
    cookieConsentEnabled: boolean
  }> = {},
) {
  return render(
    <MarketingScripts
      ga4Id=""
      googleAdsId=""
      metaPixelId=""
      cookieConsentEnabled={true}
      {...overrides}
    />,
  )
}

beforeEach(() => {
  mockConsented = null
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('MarketingScripts', () => {
  it('renders nothing when consented is null and consent is enabled (undecided/SSR)', () => {
    mockConsented = null
    renderScripts({ ga4Id: GA4_ID, cookieConsentEnabled: true })
    expect(document.querySelector('script[id="gtag-loader"]')).toBeNull()
  })

  it('renders nothing when consented is false and consent is enabled', () => {
    mockConsented = false
    renderScripts({ ga4Id: GA4_ID, cookieConsentEnabled: true })
    expect(document.querySelector('script[id="gtag-loader"]')).toBeNull()
  })

  it('renders GA4 script when consented true and ga4Id is set', () => {
    mockConsented = true
    renderScripts({ ga4Id: GA4_ID, cookieConsentEnabled: true })
    expect(document.querySelector('script[id="gtag-loader"]')).not.toBeNull()
    expect(document.querySelector('script[id="gtag-init"]')).not.toBeNull()
  })

  it('renders nothing when all IDs are empty (even if consented)', () => {
    mockConsented = true
    renderScripts({ ga4Id: '', googleAdsId: '', metaPixelId: '', cookieConsentEnabled: true })
    expect(document.querySelector('script[id]')).toBeNull()
  })

  it('loads when cookieConsentEnabled=false even if consented is null', () => {
    mockConsented = null
    renderScripts({ ga4Id: GA4_ID, cookieConsentEnabled: false })
    expect(document.querySelector('script[id="gtag-loader"]')).not.toBeNull()
  })

  it('renders Meta Pixel script when consented and pixel ID set', () => {
    mockConsented = true
    renderScripts({ metaPixelId: PIXEL_ID, cookieConsentEnabled: true })
    expect(document.querySelector('script[id="meta-pixel-init"]')).not.toBeNull()
  })

  it('renders Google Ads loader when ads ID set but ga4Id is empty', () => {
    mockConsented = true
    renderScripts({ ga4Id: '', googleAdsId: ADS_ID, cookieConsentEnabled: true })
    expect(document.querySelector('script[id="gtag-ads-loader"]')).not.toBeNull()
    expect(document.querySelector('script[id="gtag-loader"]')).toBeNull()
  })

  it('does NOT render separate ads loader when both GA4 and Ads IDs set (Ads piggybacks gtag)', () => {
    mockConsented = true
    renderScripts({ ga4Id: GA4_ID, googleAdsId: ADS_ID, cookieConsentEnabled: true })
    // Only one loader (for GA4 ID)
    expect(document.querySelector('script[id="gtag-loader"]')).not.toBeNull()
    expect(document.querySelector('script[id="gtag-ads-loader"]')).toBeNull()
  })
})
