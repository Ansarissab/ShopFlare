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
  ('storeName',                  'ShopFlare Demo Store'),
  ('tagline',                    'Quality goods, fair prices'),
  ('whatsappNumber',             ''),               -- e.g. 923001234567 (no +, country code first)
  ('contactEmail',               ''),               -- merchant inbox; also BCC for order emails
  ('senderEmail',                ''),               -- verified Resend sender (falls back to RESEND_FROM)
  ('currency',                   'PKR'),            -- one of CURRENCIES in src/lib/constants
  ('freeShippingThresholdCents', '5000'),           -- free shipping at/above ₨5,000 (0 = disabled)
  ('flatShippingRateCents',      '250');            -- flat rate below threshold

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
