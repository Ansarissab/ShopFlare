-- ════════════════════════════════════════════════════════════════════════════
-- ShopFlare — full demo seed (single executable file)
-- ════════════════════════════════════════════════════════════════════════════
-- Populates a fresh store with sensible defaults for EVERYTHING so you can see
-- how the storefront + admin behave end-to-end immediately after install:
--   • store_config   — name, currency, shipping, contact
--   • products        — 3 demo products with variants + size options + images
--   • coupons         — a percentage + a fixed-amount coupon
--   • a sample order  — 1 delivered order so the admin dashboard isn't empty
--   • a sample review — 1 approved review so the product page shows ratings
--
-- Run AFTER migrations:
--   pnpm db:migrate:local && pnpm db:seed:local     (local D1)
--   pnpm db:migrate      && pnpm db:seed            (remote D1)
--
-- Idempotent: every row uses a fixed id + `INSERT OR IGNORE`, so re-running
-- never clobbers data you've since edited in the Admin Dashboard. To reset the
-- demo data, delete the `demo_*` / `ORD-DEMO0001` rows first, then re-seed.
--
-- Currency note: default currency is PKR (0-decimal in src/lib/constants), so
-- the *_cents columns hold whole rupees here (e.g. 2500 = ₨2,500). If you change
-- the currency to a 2-decimal one (USD/EUR…), treat these as minor units.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Store config ────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO store_config (key, value) VALUES
  ('storeName',                  'ShopFlare'),
  ('tagline',                    'Quality goods, fair prices'),
  ('whatsappNumber',             ''),               -- e.g. 923001234567 (no +, country code first)
  ('contactEmail',               ''),               -- merchant inbox; also BCC for order emails
  ('senderEmail',                ''),               -- verified Resend sender (falls back to RESEND_FROM)
  ('currency',                   'PKR'),            -- one of CURRENCIES in src/lib/constants
  ('freeShippingThresholdCents', '5000'),           -- free shipping at/above ₨5,000 (0 = disabled)
  ('flatShippingRateCents',      '250'),            -- flat rate below threshold
  -- Bank-transfer details: when bankAccountNumber is set, the Bank Transfer
  -- checkout option appears and these show on the thank-you/track page + email.
  ('bankName',          'Demo Bank'),
  ('bankAccountTitle',  'ShopFlare Demo Store'),
  ('bankAccountNumber', '0000-1234567-8'),
  ('bankIban',          'PK00DEMO0000123456780000'),
  ('bankInstructions',  'Transfer the exact total and use your order number as the payment reference. We confirm within a few hours.');

-- ─── Products ────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO products (id, name, description, active) VALUES
  ('demo_tshirt', 'Classic Cotton T-Shirt', 'Soft 100% combed cotton tee with a relaxed unisex fit. Pre-shrunk and built to last wash after wash.', 1),
  ('demo_mug',    'Ceramic Coffee Mug',     'Chunky 350ml stoneware mug. Microwave- and dishwasher-safe, with a comfortable easy-grip handle.', 1),
  ('demo_cap',    'Six-Panel Baseball Cap', 'Structured cotton-twill cap with a curved brim and adjustable strap. One size fits most.', 1);

-- ─── Variants ────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO variants (id, product_id, label, color_hex, sort_order) VALUES
  ('demo_var_tshirt_black', 'demo_tshirt', 'Black', '#111111', 0),
  ('demo_var_tshirt_white', 'demo_tshirt', 'White', '#f5f5f5', 1),
  ('demo_var_mug_white',    'demo_mug',    'White', '#ffffff', 0),
  ('demo_var_cap_navy',     'demo_cap',    'Navy',  '#1e2a4a', 0);

-- ─── Size options (priceCents = whole rupees for PKR; stock -1 = unlimited) ───
INSERT OR IGNORE INTO size_options (id, variant_id, size, sku, price_cents, stock, active) VALUES
  -- T-shirt · Black
  ('demo_sz_tsb_s', 'demo_var_tshirt_black', 'S',  'TSB-S', 2500, 15, 1),
  ('demo_sz_tsb_m', 'demo_var_tshirt_black', 'M',  'TSB-M', 2500, 20, 1),
  ('demo_sz_tsb_l', 'demo_var_tshirt_black', 'L',  'TSB-L', 2500,  0, 1),  -- out of stock → shows "Notify me"
  ('demo_sz_tsb_xl','demo_var_tshirt_black', 'XL', 'TSB-XL',2700,  8, 1),
  -- T-shirt · White
  ('demo_sz_tsw_s', 'demo_var_tshirt_white', 'S',  'TSW-S', 2500, 12, 1),
  ('demo_sz_tsw_m', 'demo_var_tshirt_white', 'M',  'TSW-M', 2500, 18, 1),
  ('demo_sz_tsw_l', 'demo_var_tshirt_white', 'L',  'TSW-L', 2500, 10, 1),
  -- Mug · White (unlimited stock)
  ('demo_sz_mug_os','demo_var_mug_white',    'One Size', 'MUG-OS', 1200, -1, 1),
  -- Cap · Navy
  ('demo_sz_cap_os','demo_var_cap_navy',     'One Size', 'CAP-OS', 1800, 30, 1);

-- ─── Product images (external placeholders; swap for real R2 uploads in admin) ─
INSERT OR IGNORE INTO product_images (id, variant_id, url, r2_key, sort_order) VALUES
  ('demo_img_tsb', 'demo_var_tshirt_black', 'https://picsum.photos/seed/shopflare-tshirt-black/800/800', 'demo/tshirt-black.jpg', 0),
  ('demo_img_tsw', 'demo_var_tshirt_white', 'https://picsum.photos/seed/shopflare-tshirt-white/800/800', 'demo/tshirt-white.jpg', 0),
  ('demo_img_mug', 'demo_var_mug_white',    'https://picsum.photos/seed/shopflare-mug/800/800',          'demo/mug.jpg',          0),
  ('demo_img_cap', 'demo_var_cap_navy',     'https://picsum.photos/seed/shopflare-cap/800/800',          'demo/cap.jpg',          0);

-- ─── Coupons ─────────────────────────────────────────────────────────────────
-- NOTE: these are D1-only demo coupons (no Stripe promotion-code link), so they
-- apply on the COD path. Create coupons via the Admin Dashboard to also sync a
-- Stripe promotion code for the card-checkout path.
INSERT OR IGNORE INTO coupons (id, code, type, value, min_order_cents, per_customer_limit, used_count, active) VALUES
  ('demo_coupon_welcome', 'WELCOME10', 'percentage', 10, NULL, 1, 0, 1),
  ('demo_coupon_flat500', 'FLAT500',   'fixed',      500, 3000, 1, 0, 1);

-- ─── Sample delivered order (so the admin dashboard + reviews aren't empty) ───
INSERT OR IGNORE INTO orders
  (id, order_number, status, payment_method, customer_name, customer_email, customer_phone,
   subtotal_cents, shipping_cents, discount_cents, total_cents)
VALUES
  ('demo_order_1', 'ORD-DEMO0001', 'delivered', 'cod', 'Sample Customer',
   'sample@example.com', '923001234567', 5000, 0, 0, 5000);

INSERT OR IGNORE INTO order_items
  (id, order_id, size_option_id, product_id, variant_id, quantity, price_cents, snapshot)
VALUES
  ('demo_order_1_item_1', 'demo_order_1', 'demo_sz_tsb_m', 'demo_tshirt', 'demo_var_tshirt_black',
   2, 2500, '{"productName":"Classic Cotton T-Shirt","variantLabel":"Black","size":"M","sku":"TSB-M","imageUrl":"https://picsum.photos/seed/shopflare-tshirt-black/800/800"}');

-- ─── Sample approved review (verified purchase against the order above) ───────
INSERT OR IGNORE INTO reviews (id, order_id, product_id, customer_name, rating, body, approved) VALUES
  ('demo_review_1', 'demo_order_1', 'demo_tshirt', 'Sample Customer', 5,
   'Great quality and a perfect fit — exactly what I expected. Will order again!', 1);

-- ─── Policy pages ─────────────────────────────────────────────────────────────
-- Editable from Admin → Pages. INSERT OR IGNORE so admin edits are never clobbered.
INSERT OR IGNORE INTO pages (slug, title, content) VALUES
  ('shipping', 'Shipping Policy',
   'We process and dispatch orders within 1–2 business days of payment confirmation.

Standard Delivery: 3–5 business days after dispatch. Delivery times may vary depending on your location and courier availability.

Free Shipping: Orders above the free-shipping threshold qualify for free standard delivery. The threshold is shown at checkout.

Flat-Rate Shipping: Orders below the threshold are charged a flat shipping fee, calculated at checkout.

Once your order has been dispatched you will receive a tracking number via email or SMS (if provided). You can track your shipment on the carrier''s website or via the order-tracking page on our store.

We currently ship within the country only. International shipping is not available at this time.

If your order has not arrived within the estimated timeframe, please contact us and we will investigate with the courier.'),

  ('returns', 'Return Policy',
   'We want you to be completely satisfied with your purchase. If you are not happy with your order, we accept returns under the following conditions:

Eligibility: Items must be returned within 7 days of delivery. Products must be unused, unwashed, and in their original condition with all tags attached.

Non-returnable items: Sale items, personalised products, and items marked as final sale cannot be returned or exchanged.

How to return: Contact us via WhatsApp or email with your order number and the reason for return. We will provide you with return instructions. You are responsible for the cost of return shipping unless the item arrived damaged or incorrect.

Refunds: Once we receive and inspect the returned item, we will process your refund within 3–5 business days. Refunds are issued to the original payment method. Cash-on-delivery orders are refunded via bank transfer.

Exchanges: If you would like to exchange an item for a different size or colour, please contact us. Exchanges are subject to stock availability.

Damaged or incorrect items: If you received a damaged or wrong item, please contact us within 48 hours of delivery with photos and we will resolve it promptly at no cost to you.'),

  ('privacy', 'Privacy Policy',
   'Your privacy is important to us. This policy explains what personal information we collect, how we use it, and how we protect it.

Information we collect: When you place an order we collect your name, email address, phone number, and shipping address. We also collect order and payment details necessary to fulfil your purchase.

How we use your information: We use your information to process and deliver your orders, send order confirmations and shipping updates, respond to your enquiries, and improve our store.

Payment security: We do not store your card details. Payments are processed securely through Stripe. For bank transfers, only your order number is used as a reference.

Sharing your information: We do not sell or rent your personal information to third parties. We share only what is necessary with service providers (courier companies, payment processors) to fulfil your order.

Data retention: We retain your order information for accounting and legal compliance purposes. You may request deletion of your personal data at any time by contacting us, subject to our legal obligations.

Cookies: Our store may use essential cookies to maintain your shopping cart session. No tracking or advertising cookies are used without your consent.

Contact: If you have any questions about this policy or your personal data, please contact us via the email or WhatsApp number listed on our store.'),

  ('terms', 'Terms of Service',
   'By accessing and using this store you agree to the following terms and conditions. Please read them carefully before placing an order.

Use of the store: You may use this store only for lawful purposes and in accordance with these terms. You agree not to use the store in any way that could damage, disable, or impair the service.

Products and pricing: We reserve the right to modify product descriptions, prices, and availability at any time without prior notice. All prices are inclusive of applicable taxes unless stated otherwise.

Orders: Placing an order constitutes an offer to purchase. We reserve the right to refuse or cancel any order at our discretion, including cases of pricing errors or suspected fraud. You will be notified and any payment received will be refunded.

Payment: We accept the payment methods listed at checkout. For bank transfers, your order is confirmed only after payment is received and verified. For card payments, your card is charged at the time of checkout.

Shipping and delivery: Delivery timeframes are estimates and not guaranteed. We are not responsible for delays caused by couriers or circumstances beyond our control.

Returns and refunds: Returns and refunds are subject to our Return Policy, available on this store.

Limitation of liability: To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the store or products purchased.

Changes to terms: We may update these terms from time to time. Continued use of the store after changes are posted constitutes acceptance of the revised terms.

Contact: For any questions about these terms, please reach out to us via the contact details listed on our store.');

