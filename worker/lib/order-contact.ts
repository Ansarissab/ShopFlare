// Ownership check for public order access (order lookup, cancellation, and
// reviewing-as-buyer). The caller proves they own an order — already identified
// by its order number — by supplying the contact they ordered with: the email
// must match exactly, OR the supplied phone digits must match the stored number.
//
// Security: the phone branch matches by suffix (`endsWith`) to tolerate country-
// code variance, so it MUST require a meaningful run of digits. A 1-digit suffix
// like "1" would otherwise match a huge fraction of stored numbers, turning the
// ownership gate into an order/PII enumeration oracle.
//
// Pure (no D1) so it is unit-tested directly — the single source of truth shared
// by orders.ts and reviews.ts instead of three hand-copied inline checks.
export const MIN_CONTACT_PHONE_DIGITS = 7

const digitsOnly = (s: string) => s.replace(/\D/g, '')

export function contactMatchesOrder(
  order: { customerEmail: string | null; customerPhone: string | null },
  contact: string,
): boolean {
  const contactLower = contact.trim().toLowerCase()
  const emailMatch =
    order.customerEmail !== null && order.customerEmail.toLowerCase() === contactLower

  const contactDigits = digitsOnly(contact)
  const phoneMatch =
    contactDigits.length >= MIN_CONTACT_PHONE_DIGITS &&
    order.customerPhone !== null &&
    digitsOnly(order.customerPhone).endsWith(contactDigits)

  return emailMatch || phoneMatch
}
