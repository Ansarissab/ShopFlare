<h1 align="center">🔥 ShopFlare</h1>

<p align="center"><b>A free online store that small businesses can run without paying monthly platform fees.</b><br/>Open source. $0 hosting. Built on Next.js + Cloudflare.</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-087EA4?logo=react&logoColor=white">
  <img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white">
  <img alt="Stripe" src="https://img.shields.io/badge/Stripe-Checkout-635BFF?logo=stripe&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="Hosting cost" src="https://img.shields.io/badge/hosting-%240%2Fmo-2ea44f">
</p>

<p align="center">
  <a href="https://ansarissab.github.io/ShopFlare/"><b>🌐 View the project overview »</b></a>
</p>

---

## Why this exists

In early 2024 I started an online store with two partners. We got some sales, but the monthly ad and platform costs kept eating money we did not have yet. When a small $25 bill arrived that we could not pay, the store shut down.

That stuck with me. I kept asking the same question: why is there no proper free option for tiny businesses just getting started? Every tool I found had a fee hidden somewhere. So I stopped looking and built one.

**ShopFlare is for people starting from zero** — owners who want to sell online without platform fees taking a cut before they have even found their feet. It is not trying to replace the big platforms. It is a simple, honest starting point, nothing more.

## What it does

**For shoppers**
- Browse products with colors, sizes and live stock
- Fast search, and a cart that remembers them
- Pay by card, cash on delivery, bank transfer, WhatsApp, or in person
- Track and cancel their own orders
- Verified reviews and ratings
- "Email me when it is back in stock"
- Install the store like an app and use it offline
- Shop in English, French or Urdu (full right-to-left)

**For the shop owner**
- Add products and photos (compressed automatically on upload)
- Manage orders, statuses and shipping tracking
- Discount coupons synced with payments
- Approve reviews, answer FAQs, write blog posts
- Built-in cash register for in-person sales
- Change name, logo, colors, shipping and policies live — no developer, no redeploy
- One-click themes and a built-in analytics dashboard

## Why it costs $0

Everything runs inside Cloudflare's free tier, so there is no monthly server bill. Payments go through Stripe, which only takes a small cut when a real sale actually happens — never a flat fee. A small shop can launch, take orders, and pay nothing until it starts earning.

## How it is built

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 + React 19 (runs as a Cloudflare Worker) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| API | Hono on a second Cloudflare Worker |
| Database | Cloudflare D1 (SQLite) via Drizzle ORM |
| Images | Cloudflare R2 |
| Cache | Cloudflare KV |
| Payments | Stripe Checkout (no raw card data ever) |
| Email | Resend |
| Notifications | Web Push (PWA) |
| Bot protection | Cloudflare Turnstile |

## Built to last

| Automated tests | Coverage gate | Build phases | Documented decisions |
|:---:|:---:|:---:|:---:|
| **1,500+** | **95%** | **29** | **17** |

Every feature is checked by tests that run on their own before anything goes live. Card details are never stored, the admin area is locked down, every form is guarded against bots, and the store works for screen readers and right-to-left languages.

## Author

Built by **Muhammad Zahid Ansari**
[GitHub](https://github.com/Ansarissab) · [LinkedIn](https://www.linkedin.com/in/zahidensari/)
