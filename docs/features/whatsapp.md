# WhatsApp Integration

## Enable / Disable (Feature Flag)

WhatsApp is **off by default**. Enable via Admin → Settings → Contact → **Enable WhatsApp** checkbox.
The flag (`whatsappEnabled`) is stored in Store Config and applied at runtime — no redeploy.

Gating rules (all three surfaces obey the same matrix):

| `whatsappEnabled` | `whatsappNumber` set | Result                                            |
| ----------------- | -------------------- | ------------------------------------------------- |
| OFF               | any                  | No WhatsApp UI anywhere                           |
| ON                | empty                | Hidden — admin hint reminds merchant              |
| ON                | set                  | Floating widget + per-product button + POS button |

Toggle round-trips through PUT `/api/admin/config/store` (same endpoint as all other settings).

## Floating Chat Widget (Phase 19)

A fixed bottom-right button appears on **every** storefront page (mounted in `(store)/layout.tsx`).

- Opens `wa.me/{number}?text=...` with a generic greeting (`en.whatsapp.contactGreeting`).
- Brand green `#25D366` background — intentional exception to the CSS-var colour rule (same exception as `WhatsAppButton.tsx`).
- In PWA standalone mode (AppTabBar visible) the widget shifts up to `bottom-20` (80px) so both remain tappable.
- `aria-label` from `en.store.whatsappWidgetLabel`; SVG icon is `aria-hidden`.

## Customer order flow

Customer selects product → clicks "Order on WhatsApp" → WhatsApp opens with pre-filled message:

```
Hi! I want to order:
Product: [Name] (SKU: XXX)
Variant: Red / XL
Price: ₨2,500 + ₨200 shipping
Total: ₨2,700
Payment: WhatsApp arrangement
Track: https://yourstore.com/track/ORD-XXXXX
```

Message opens in customer's WhatsApp, pre-addressed to merchant's number.
Customer reviews and taps Send.

## Merchant receives

Message arrives in merchant's WhatsApp (or WhatsApp Business app).
Merchant manually creates order in Admin POS → shares tracking link back.

## Cost

Zero. Uses `wa.me` deep link — no WhatsApp API required.
No API keys, no Meta account, no monthly fee.

## Merchant WhatsApp number

The number is read from `store_config` (`whatsappNumber` key) at runtime — no redeployment needed to change it. Configure via Admin → Settings → Store → WhatsApp Number (Phase 2), or set directly in D1 after running `pnpm db:seed`.
Format: country code + number, no spaces (e.g. `923001234567` for Pakistan).

## Message content

The pre-filled message is composed from i18n strings in `lib/i18n/en.ts` — never hardcoded in components. All labels (product, variant, size, SKU, qty, price, footer) come from `en.whatsapp.*`.

## POS WhatsApp receipt

After in-person sale:
Admin POS → complete sale → "Send WhatsApp Receipt"
Opens WhatsApp with order summary addressed to customer's phone.
