// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { WhatsAppWidget } from './WhatsAppWidget'
import { en } from '@/lib/i18n/en'
import type { StoreConfigData } from '@/lib/schemas/config'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

let mockConfig: Partial<StoreConfigData> | null = null
let mockIsStandalone = false

vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: mockConfig, loading: false }),
}))
vi.mock('@/hooks/useDisplayMode', () => ({
  useIsStandalone: () => mockIsStandalone,
}))

const phone = '923001234567'

function withNumber(extra: Partial<StoreConfigData> = {}): Partial<StoreConfigData> {
  return { whatsappNumber: phone, ...extra }
}

describe('WhatsAppWidget gating matrix', () => {
  it('flag OFF (default) + number set → renders nothing', () => {
    mockConfig = withNumber({ whatsappEnabled: false })
    const { container } = render(<WhatsAppWidget />)
    expect(container.firstChild).toBeNull()
  })

  it('flag ON + no number → renders nothing', () => {
    mockConfig = { whatsappEnabled: true, whatsappNumber: '' }
    const { container } = render(<WhatsAppWidget />)
    expect(container.firstChild).toBeNull()
  })

  it('config null → renders nothing', () => {
    mockConfig = null
    const { container } = render(<WhatsAppWidget />)
    expect(container.firstChild).toBeNull()
  })

  it('flag ON + number set → renders anchor with correct aria-label', () => {
    mockConfig = withNumber({ whatsappEnabled: true })
    render(<WhatsAppWidget />)
    const link = screen.getByRole('link', { name: en.store.whatsappWidgetLabel })
    expect(link).toBeTruthy()
  })

  it('flag ON + number set → href contains the phone number', () => {
    mockConfig = withNumber({ whatsappEnabled: true })
    render(<WhatsAppWidget />)
    const link = screen.getByRole('link', { name: en.store.whatsappWidgetLabel }) as HTMLAnchorElement
    expect(link.href).toContain(phone)
  })

  it('flag ON + number set → href encodes contactGreeting', () => {
    mockConfig = withNumber({ whatsappEnabled: true })
    render(<WhatsAppWidget />)
    const link = screen.getByRole('link', { name: en.store.whatsappWidgetLabel }) as HTMLAnchorElement
    expect(link.href).toContain(encodeURIComponent(en.whatsapp.contactGreeting))
  })

  it('in standalone mode → uses bottom-20 class instead of bottom-4', () => {
    mockIsStandalone = true
    mockConfig = withNumber({ whatsappEnabled: true })
    render(<WhatsAppWidget />)
    const link = screen.getByRole('link', { name: en.store.whatsappWidgetLabel })
    expect(link.className).toContain('bottom-20')
    expect(link.className).not.toContain('bottom-4')
    mockIsStandalone = false
  })

  it('in browser mode → uses bottom-4 class', () => {
    mockIsStandalone = false
    mockConfig = withNumber({ whatsappEnabled: true })
    render(<WhatsAppWidget />)
    const link = screen.getByRole('link', { name: en.store.whatsappWidgetLabel })
    expect(link.className).toContain('bottom-4')
  })
})
