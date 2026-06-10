// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BankTransferInstructions } from './BankTransferInstructions'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'

let mockConfig: Record<string, unknown> | null = null

vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: mockConfig }),
}))

const fullConfig = {
  currency: 'PKR',
  bankName: 'Habib Bank',
  bankAccountTitle: 'ShopFlare Ltd',
  bankAccountNumber: '1234567890',
  bankIban: 'PK12HABB0000001234567890',
  bankInstructions: 'Send a screenshot after paying.',
  whatsappNumber: '+923001234567',
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockConfig = null
})

describe('BankTransferInstructions', () => {
  it('returns null when no bank account number configured', () => {
    mockConfig = { currency: 'PKR' }
    const { container } = render(
      <BankTransferInstructions orderNumber="SF-100" totalCents={5000} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null when config is missing entirely', () => {
    mockConfig = null
    const { container } = render(
      <BankTransferInstructions orderNumber="SF-100" totalCents={5000} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders heading, formatted amount intro and order reference', () => {
    mockConfig = fullConfig
    render(<BankTransferInstructions orderNumber="SF-200" totalCents={5000} />)
    expect(screen.getByText(en.bankTransfer.heading)).toBeTruthy()

    const amount = formatPrice(5000, 'PKR')
    expect(screen.getByText(en.bankTransfer.intro.replace('{amount}', amount))).toBeTruthy()
    expect(
      screen.getByText(en.bankTransfer.reference.replace('{orderNumber}', 'SF-200')),
    ).toBeTruthy()
  })

  it('renders each configured bank detail row', () => {
    mockConfig = fullConfig
    render(<BankTransferInstructions orderNumber="SF-200" totalCents={5000} />)
    expect(screen.getByText(en.bankTransfer.bankName)).toBeTruthy()
    expect(screen.getByText('Habib Bank')).toBeTruthy()
    expect(screen.getByText(en.bankTransfer.accountTitle)).toBeTruthy()
    expect(screen.getByText('ShopFlare Ltd')).toBeTruthy()
    expect(screen.getByText(en.bankTransfer.accountNumber)).toBeTruthy()
    expect(screen.getByText('1234567890')).toBeTruthy()
    expect(screen.getByText(en.bankTransfer.iban)).toBeTruthy()
    expect(screen.getByText('PK12HABB0000001234567890')).toBeTruthy()
  })

  it('skips rows whose value is undefined', () => {
    mockConfig = {
      currency: 'PKR',
      bankAccountNumber: '999',
      // bankName, bankAccountTitle, bankIban all undefined
    }
    render(<BankTransferInstructions orderNumber="SF-300" totalCents={1000} />)
    // account number row shown
    expect(screen.getByText(en.bankTransfer.accountNumber)).toBeTruthy()
    expect(screen.getByText('999')).toBeTruthy()
    // bank name row not rendered
    expect(screen.queryByText(en.bankTransfer.bankName)).toBeNull()
    expect(screen.queryByText(en.bankTransfer.iban)).toBeNull()
  })

  it('renders custom instructions when present', () => {
    mockConfig = fullConfig
    render(<BankTransferInstructions orderNumber="SF-200" totalCents={5000} />)
    expect(screen.getByText('Send a screenshot after paying.')).toBeTruthy()
  })

  it('omits instructions paragraph when not configured', () => {
    mockConfig = { ...fullConfig, bankInstructions: undefined }
    render(<BankTransferInstructions orderNumber="SF-200" totalCents={5000} />)
    expect(screen.queryByText('Send a screenshot after paying.')).toBeNull()
  })

  it('renders whatsapp proof note when whatsapp number set', () => {
    mockConfig = fullConfig
    render(<BankTransferInstructions orderNumber="SF-200" totalCents={5000} />)
    expect(screen.getByText(en.bankTransfer.whatsappProof)).toBeTruthy()
  })

  it('omits whatsapp proof note when no whatsapp number', () => {
    mockConfig = { ...fullConfig, whatsappNumber: undefined }
    render(<BankTransferInstructions orderNumber="SF-200" totalCents={5000} />)
    expect(screen.queryByText(en.bankTransfer.whatsappProof)).toBeNull()
  })
})
