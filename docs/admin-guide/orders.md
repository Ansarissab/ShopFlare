# Managing Orders

## Order statuses

| Status | Meaning | Who sets it |
|---|---|---|
| `pending` | Created, awaiting payment/confirmation | System |
| `confirmed` | Payment received or merchant confirmed | System (Stripe) / Merchant (COD) |
| `processing` | Being prepared | Merchant |
| `shipped` | Dispatched, tracking available | Merchant |
| `delivered` | Received by customer | Merchant |
| `cancelled` | Cancelled | Customer (if pending/confirmed) / Merchant |

## Add tracking number

Admin → Orders → click order → Add Tracking Number
Enter tracking number + carrier name → Save
Customer receives updated status on tracking page.
System sends shipping notification (email + WhatsApp link).

## COD confirmation

COD orders arrive as `pending`.
Merchant confirms: Admin → Orders → click order → Mark Confirmed.

## Refunds

Process refunds directly in Stripe Dashboard.
Stripe webhook updates order status to `cancelled` automatically.
