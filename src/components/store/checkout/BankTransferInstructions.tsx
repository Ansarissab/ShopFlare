'use client'

import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import type { BankTransferInstructionsProps } from '@/lib/types/store'

/**
 * Bank-transfer payment instructions for a placed order. Shown on the thank-you
 * page and the order tracking page. Reads the merchant's configured bank details
 * from store config; renders nothing until an account number is configured.
 */
export function BankTransferInstructions({ orderNumber, totalCents }: BankTransferInstructionsProps) {
  const { config } = useStoreConfig()
  if (!config?.bankAccountNumber) return null

  const t = en.bankTransfer
  const amount = formatPrice(totalCents, config.currency)

  const rows: Array<[string, string | undefined]> = [
    [t.bankName, config.bankName],
    [t.accountTitle, config.bankAccountTitle],
    [t.accountNumber, config.bankAccountNumber],
    [t.iban, config.bankIban],
  ]

  return (
    <div className="w-full rounded-lg border bg-muted/40 p-5 text-left">
      <h2 className="text-base font-semibold">{t.heading}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.intro.replace('{amount}', amount)}
      </p>
      <p className="text-sm text-muted-foreground">
        {t.reference.replace('{orderNumber}', orderNumber)}
      </p>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([label, value]) =>
          value ? (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ) : null,
        )}
      </dl>

      {config.bankInstructions && (
        <p className="mt-4 text-sm text-muted-foreground">{config.bankInstructions}</p>
      )}
      {config.whatsappNumber && (
        <p className="mt-3 text-xs text-muted-foreground">{t.whatsappProof}</p>
      )}
    </div>
  )
}
