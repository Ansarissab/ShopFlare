-- ════════════════════════════════════════════════════════════════════════════
-- ShopFlare — full demo seed (single executable file)
-- ════════════════════════════════════════════════════════════════════════════
-- Populates a fresh store with sensible defaults for EVERYTHING so you can see
-- how the storefront + admin behave end-to-end immediately after install:
--   • store_config   — name, currency, shipping, contact
--   • products        — 4 demo products with variants, size options, and images (T-shirt Black/White have 3 images each to demo the image carousel)
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
  ('flatShippingRateCents',      '299'),            -- flat rate below threshold
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
-- DEMO ONLY: URLs use picsum WebP to keep PageSpeed green (~60-70% smaller than JPEG).
-- Production uses real R2 uploads served as AVIF/WebP via the ImageUpload pipeline.
INSERT OR IGNORE INTO product_images (id, variant_id, url, r2_key, sort_order) VALUES
  ('demo_img_tsb', 'demo_var_tshirt_black', 'https://picsum.photos/seed/shopflare-tshirt-black/640/640.webp', 'demo/tshirt-black.jpg', 0),
  ('demo_img_tsb_2', 'demo_var_tshirt_black', 'https://picsum.photos/seed/sf-tsb-front/640/640.webp', 'demo/tshirt-black-2.jpg', 1),
  ('demo_img_tsb_3', 'demo_var_tshirt_black', 'https://picsum.photos/seed/sf-tsb-detail/640/640.webp', 'demo/tshirt-black-3.jpg', 2),
  ('demo_img_tsw', 'demo_var_tshirt_white', 'https://picsum.photos/seed/shopflare-tshirt-white/640/640.webp', 'demo/tshirt-white.jpg', 0),
  ('demo_img_tsw_2', 'demo_var_tshirt_white', 'https://picsum.photos/seed/sf-tsw-side/640/640.webp', 'demo/tshirt-white-2.jpg', 1),
  ('demo_img_tsw_3', 'demo_var_tshirt_white', 'https://picsum.photos/seed/sf-tsw-back/640/640.webp', 'demo/tshirt-white-3.jpg', 2),
  ('demo_img_mug', 'demo_var_mug_white',    'https://picsum.photos/seed/shopflare-mug/640/640.webp',          'demo/mug.jpg',          0),
  ('demo_img_cap', 'demo_var_cap_navy',     'https://picsum.photos/seed/shopflare-cap/640/640.webp',          'demo/cap.jpg',          0);

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
   2, 2500, '{"productName":"Classic Cotton T-Shirt","variantLabel":"Black","size":"M","sku":"TSB-M","imageUrl":"https://picsum.photos/seed/shopflare-tshirt-black/640/640.webp"}');

-- ─── Sample approved review (verified purchase against the order above) ───────
INSERT OR IGNORE INTO reviews (id, order_id, product_id, customer_name, rating, body, approved) VALUES
  ('demo_review_1', 'demo_order_1', 'demo_tshirt', 'Sample Customer', 5,
   'Great quality and a perfect fit — exactly what I expected. Will order again!', 1);

-- ─── Categories ──────────────────────────────────────────────────────────────
-- 2 top-level demo categories; products linked via product_categories junction.
-- INSERT OR IGNORE keeps re-runs idempotent (matches seed.sql convention).
INSERT OR IGNORE INTO categories (id, name, slug, description, sort_order, active) VALUES
  ('demo_cat_apparel',     'Apparel',     'apparel',     'T-shirts, caps, and clothing', 0, 1),
  ('demo_cat_accessories', 'Accessories', 'accessories', 'Bags, mugs, and more',         1, 1);

-- Link products → categories
INSERT OR IGNORE INTO product_categories (product_id, category_id, sort_order) VALUES
  ('demo_tshirt', 'demo_cat_apparel',     0),
  ('demo_cap',    'demo_cat_apparel',     1),
  ('demo_mug',    'demo_cat_accessories', 0),
  ('demo_bag',    'demo_cat_accessories', 1);

-- ─── Policy pages ─────────────────────────────────────────────────────────────
-- Editable from Admin → Pages. INSERT OR IGNORE so admin edits are never clobbered.
INSERT OR IGNORE INTO pages (slug, title, content, updated_at) VALUES
  ('shipping', 'Shipping Policy',
   'We process and dispatch orders within 1–2 business days of payment confirmation.

Standard Delivery: 3–5 business days after dispatch. Delivery times may vary depending on your location and courier availability.

Free Shipping: Orders above the free-shipping threshold qualify for free standard delivery. The threshold is shown at checkout.

Flat-Rate Shipping: Orders below the threshold are charged a flat shipping fee, calculated at checkout.

Once your order has been dispatched you will receive a tracking number via email or SMS (if provided). You can track your shipment on the carrier''s website or via the order-tracking page on our store.

We currently ship within the country only. International shipping is not available at this time.

If your order has not arrived within the estimated timeframe, please contact us and we will investigate with the courier.', datetime('now')),

  ('returns', 'Return Policy',
   'We want you to be completely satisfied with your purchase. If you are not happy with your order, we accept returns under the following conditions:

Eligibility: Items must be returned within 7 days of delivery. Products must be unused, unwashed, and in their original condition with all tags attached.

Non-returnable items: Sale items, personalised products, and items marked as final sale cannot be returned or exchanged.

How to return: Contact us via WhatsApp or email with your order number and the reason for return. We will provide you with return instructions. You are responsible for the cost of return shipping unless the item arrived damaged or incorrect.

Refunds: Once we receive and inspect the returned item, we will process your refund within 3–5 business days. Refunds are issued to the original payment method. Cash-on-delivery orders are refunded via bank transfer.

Exchanges: If you would like to exchange an item for a different size or colour, please contact us. Exchanges are subject to stock availability.

Damaged or incorrect items: If you received a damaged or wrong item, please contact us within 48 hours of delivery with photos and we will resolve it promptly at no cost to you.', datetime('now')),

  ('privacy', 'Privacy Policy',
   'Your privacy is important to us. This policy explains what personal information we collect, how we use it, and how we protect it.

Information we collect: When you place an order we collect your name, email address, phone number, and shipping address. We also collect order and payment details necessary to fulfil your purchase.

How we use your information: We use your information to process and deliver your orders, send order confirmations and shipping updates, respond to your enquiries, and improve our store.

Payment security: We do not store your card details. Payments are processed securely through Stripe. For bank transfers, only your order number is used as a reference.

Sharing your information: We do not sell or rent your personal information to third parties. We share only what is necessary with service providers (courier companies, payment processors) to fulfil your order.

Data retention: We retain your order information for accounting and legal compliance purposes. You may request deletion of your personal data at any time by contacting us, subject to our legal obligations.

Cookies: Our store may use essential cookies to maintain your shopping cart session. No tracking or advertising cookies are used without your consent.

Contact: If you have any questions about this policy or your personal data, please contact us via the email or WhatsApp number listed on our store.', datetime('now')),

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

Contact: For any questions about these terms, please reach out to us via the contact details listed on our store.', datetime('now'));

-- ─── Quilted Tote Bag — multi-image demo product ──────────────────────────────
-- 2 variants × 3 images each — exercises the ImageCarousel component end-to-end.
INSERT OR IGNORE INTO products (id, name, description, active) VALUES
  ('demo_bag', 'Quilted Tote Bag',
   'Premium vegan-leather tote with a quilted finish and gold-tone hardware. Spacious main compartment with a zip closure, inner slip pocket, and adjustable shoulder strap.',
   1);

INSERT OR IGNORE INTO variants (id, product_id, label, color_hex, sort_order) VALUES
  ('demo_var_bag_black', 'demo_bag', 'Midnight Black', '#1a1a1a', 0),
  ('demo_var_bag_blush', 'demo_bag', 'Blush Pink',     '#e8a0a0', 1);

INSERT OR IGNORE INTO size_options (id, variant_id, size, sku, price_cents, stock, active) VALUES
  ('demo_sz_bag_blk_os', 'demo_var_bag_black', 'One Size', 'BAG-BLK-OS', 4500, 12, 1),
  ('demo_sz_bag_bls_os', 'demo_var_bag_blush', 'One Size', 'BAG-BLS-OS', 4500,  8, 1);

INSERT OR IGNORE INTO product_images (id, variant_id, url, r2_key, sort_order) VALUES
  ('demo_img_bag_blk_1', 'demo_var_bag_black', 'https://picsum.photos/seed/sf-bag-blk-1/640/640.webp', 'demo/bag-black-1.jpg', 0),
  ('demo_img_bag_blk_2', 'demo_var_bag_black', 'https://picsum.photos/seed/sf-bag-blk-2/640/640.webp', 'demo/bag-black-2.jpg', 1),
  ('demo_img_bag_blk_3', 'demo_var_bag_black', 'https://picsum.photos/seed/sf-bag-blk-3/640/640.webp', 'demo/bag-black-3.jpg', 2),
  ('demo_img_bag_bls_1', 'demo_var_bag_blush', 'https://picsum.photos/seed/sf-bag-bls-1/640/640.webp', 'demo/bag-blush-1.jpg', 0),
  ('demo_img_bag_bls_2', 'demo_var_bag_blush', 'https://picsum.photos/seed/sf-bag-bls-2/640/640.webp', 'demo/bag-blush-2.jpg', 1),
  ('demo_img_bag_bls_3', 'demo_var_bag_blush', 'https://picsum.photos/seed/sf-bag-bls-3/640/640.webp', 'demo/bag-blush-3.jpg', 2);

-- ─── Demo blog posts (idempotent; delete demo_blog_* rows to remove) ──────────
-- 4 ready-to-publish posts for a general ecommerce store. Staggered timestamps
-- give the blog list a realistic date spread (newest → demo_blog_1 at -3 days).
-- cover_r2_key / cover_alt are NULL — storefront handles missing covers gracefully.
INSERT OR IGNORE INTO blog_posts
  (id, slug, title, body_html, excerpt, cover_r2_key, cover_alt, tags, status, published_at, created_at, updated_at)
VALUES

  -- 1 · Product-care / how-to guide ──────────────────────────────────────────
  ('demo_blog_1',
   'how-to-care-for-your-cotton-tee',
   'How to Care for Your Cotton T-Shirt So It Lasts for Years',
   '<p>A good cotton tee is one of the most versatile items in your wardrobe — but only if you treat it right. Washing and drying it the wrong way is the fastest route to a shrunken, faded, sad-looking shirt. Follow these simple steps and yours will look just as good in year three as it did on day one.</p>

<h2>Wash in Cold Water</h2>
<p>Hot water is cotton''s worst enemy. It breaks down the fibres faster and is the main reason tees shrink. Always set your machine to a cold or cool cycle (30 °C or below). Cold water also uses less energy — good for your bill and the planet.</p>

<h2>Turn It Inside Out</h2>
<p>Before throwing your tee in the wash, turn it inside out. This protects the outer surface from friction and keeps prints, graphics, and the visible face of the fabric looking crisp for much longer.</p>

<h2>Use a Gentle Detergent</h2>
<p>Harsh detergents strip the natural oils from cotton fibres, making the fabric feel rough over time. A mild, fragrance-free detergent is all you need. You don''t need more than the recommended dose — extra detergent leaves residue that makes fabric stiff.</p>

<h2>Skip the Tumble Dryer When You Can</h2>
<p>Heat is the second big culprit after hot water. High dryer heat causes shrinkage and wears out elastic fibres in the weave. Air-dry your tee by laying it flat or hanging it on a hanger — this also helps it keep its shape. If you must use a dryer, choose the lowest heat setting and remove the shirt while it''s still slightly damp.</p>

<h2>Store It Folded, Not Hung</h2>
<p>Hanging heavy cotton on a thin hanger stretches the shoulder seams over time. Fold your tees and stack them — this keeps the collar and shoulders in shape.</p>

<h2>Quick Checklist</h2>
<ul>
  <li>Cold wash (30 °C or below)</li>
  <li>Turn inside out before washing</li>
  <li>Mild detergent, correct dose</li>
  <li>Air-dry flat or on a hanger</li>
  <li>Low heat if using a dryer; remove slightly damp</li>
  <li>Fold for storage — don''t hang on thin hangers</li>
</ul>

<p>That''s really all there is to it. A little care goes a long way, and these habits take about five seconds to build into your routine.</p>',
   'A few simple washing and drying habits can keep your cotton tee looking new for years. Here''s exactly what to do — and what to avoid.',
   NULL, NULL,
   '["care","tips","apparel"]',
   'published',
   datetime('now', '-3 days'),
   datetime('now', '-3 days'),
   datetime('now', '-3 days')),

  -- 2 · Buyer''s guide / how-to-choose ────────────────────────────────────────
  ('demo_blog_2',
   'how-to-choose-the-right-tote-bag',
   'How to Choose the Right Tote Bag: A Practical Buyer''s Guide',
   '<p>Tote bags have become a daily carry staple — but walk into any store and you''ll find dozens of options at wildly different price points. Knowing what to look for saves you from buying something that falls apart after a month or turns out to be the wrong size for how you actually use it.</p>

<h2>Start with How You''ll Use It</h2>
<p>This is the most important question and most people skip it. A bag for carrying groceries needs to be large and sturdy. A bag for work or uni needs structure and ideally an inner pocket for your laptop or documents. A bag for everyday errands can be lighter and more compact. Get clear on your primary use case before you look at anything else.</p>

<h2>Material Matters More Than You Think</h2>
<p>Canvas is the most common tote material — it''s durable, washable, and inexpensive. Heavy cotton canvas (around 12 oz or above) holds its shape well and handles real weight. Vegan leather gives a more polished look and wipes clean easily, making it a better fit for work or going out. Real leather is the most durable but requires more maintenance. Avoid thin nylon if you plan to carry anything heavy — the handles will dig into your shoulder.</p>

<h2>Check the Stitching at the Handles</h2>
<p>The handles are the first thing that fails on a cheap bag. Look for double-stitched or reinforced handle attachment points. Bartack stitching (the dense rectangular stitch at the base of each handle) is a good sign the manufacturer put thought into durability. Give the handles a firm tug — they shouldn''t shift or feel loose.</p>

<h2>Size: Bigger Isn''t Always Better</h2>
<p>A very large tote is great for the beach or a market run, but it encourages you to overload it — which means a heavy shoulder by the end of the day. For daily carry, a medium tote (roughly 35–40 cm wide, 30–35 cm tall) is practical without being unwieldy. Make sure the opening is wide enough that you can actually find things inside it.</p>

<h2>Pockets Make a Real Difference</h2>
<p>An open tote is essentially a bag-shaped hole. Even one interior zip pocket changes how usable the bag is — keys, cards, and your phone have a home instead of sinking to the bottom. An exterior slip pocket is a bonus for your phone or transit card.</p>

<h2>Quick Checklist Before You Buy</h2>
<ul>
  <li>Does the size match how I''ll actually use it?</li>
  <li>Is the material appropriate for my lifestyle (washable canvas vs. wipe-clean leather)?</li>
  <li>Are the handles reinforced and comfortable to hold?</li>
  <li>Is there at least one secure inner pocket?</li>
  <li>Does the zip closure (if any) run smoothly?</li>
</ul>

<p>A good tote bag should feel like it was made for how you live, not just how it looks on a shelf. Take five minutes to answer these questions and you''ll buy something you''ll actually use every day.</p>',
   'Not all tote bags are built the same. This guide walks you through the key things to check — size, material, stitching, and pockets — so you buy one that lasts.',
   NULL, NULL,
   '["guide","accessories","bags"]',
   'published',
   datetime('now', '-9 days'),
   datetime('now', '-9 days'),
   datetime('now', '-9 days')),

  -- 3 · Behind-the-scenes / brand story ──────────────────────────────────────
  ('demo_blog_3',
   'why-we-started-shopflare',
   'Why We Started This Store — and What We Actually Stand For',
   '<p>We get asked this question a lot, usually from customers who want to know if we''re just another drop-shipping operation or if there''s a real person behind the orders. It''s a fair question. The internet is full of stores that look polished and deliver disappointment. We started this store because we''d been on the receiving end of that disappointment too many times ourselves.</p>

<h2>The Problem We Kept Running Into</h2>
<p>A few years ago, buying basic, well-made everyday items online in this market felt harder than it should have been. You''d either pay a lot for imported goods with a two-week wait, or buy cheap and end up replacing it in a month. The middle ground — reasonable price, decent quality, ships from here, actually arrives — was surprisingly hard to find.</p>

<p>We didn''t set out to build a big brand. We started small: a few products we believed in, a simple website, and a WhatsApp number that we actually answered. That''s still the core of how we operate.</p>

<h2>What We Prioritise</h2>
<p>Every product we stock goes through a simple test: would we buy this ourselves, at this price? If the answer is no, it doesn''t go on the site. That sounds obvious, but you''d be surprised how many stores don''t apply it.</p>

<p>We also care about what happens after the sale. If something arrives damaged, we fix it — no long email threads, no "please send photos to five different addresses." We''ve been customers long enough to know that how a store handles problems says more about them than how they handle a smooth order.</p>

<h2>What Comes Next</h2>
<p>We''re a small operation and we''re fine with that for now. We''d rather grow slowly and keep the quality consistent than scale up fast and start making the compromises that turn good stores into average ones.</p>

<p>If you''ve got questions about a product, an order, or just want to tell us we got something wrong, our WhatsApp and email are on the contact page. We read everything.</p>

<p>Thanks for shopping with us — it genuinely means a lot.</p>',
   'We started this store because finding well-made everyday products at a fair price was harder than it should be. Here''s the honest version of why we exist.',
   NULL, NULL,
   '["brand","story","about"]',
   'published',
   datetime('now', '-16 days'),
   datetime('now', '-16 days'),
   datetime('now', '-16 days')),

  -- 4 · Seasonal / gift-ideas ──────────────────────────────────────────────
  ('demo_blog_4',
   'gift-ideas-for-people-who-have-everything',
   'Gift Ideas for People Who Say They Don''t Need Anything',
   '<p>We all have at least one person on our list who, when asked what they want, says "nothing, really." They''re not being difficult — they just already have the things they thought to ask for. The trick is to find something useful enough that they''ll actually use it, but not so personal that it feels like a guess. Here are a few ideas that tend to land well.</p>

<h2>Something They Use Every Day But Never Buy for Themselves</h2>
<p>The best gifts in this category are the things people put off replacing even when they''re worn out — a decent coffee mug, a tote bag that''s been held together by optimism for the last year, a well-made basic tee in a colour they always reach for. These items feel low-stakes to the giver but genuinely appreciated by the receiver because they solve a small, real problem.</p>

<h2>A Good Mug Is Underrated</h2>
<p>A ceramic mug sounds boring until you''ve drunk your morning coffee out of a thick, well-made one and realised how much it actually improves the experience. Weight, handle comfort, and the way it holds heat all matter. A chunky stoneware mug — the kind that feels like it could survive a minor disaster — is a gift most people will use every single morning for years.</p>

<h2>The Classic Tee in a New Colour</h2>
<p>Everyone has a favourite t-shirt. It''s usually several years old and slightly better than everything else in their drawer because they''ve never found an exact replacement. A well-made cotton tee in a colour they wouldn''t necessarily buy themselves — a clean white, a deep navy, a washed black — gives them something new to reach for without the risk of a completely wrong gift.</p>

<h2>A Bag They''ll Actually Carry</h2>
<p>Tote bags and structured everyday bags are practical gifts that don''t expire. A good tote in a neutral colour goes with most wardrobes, holds a lot, and gets used constantly — on the commute, at the market, as a gym bag, as an everything bag. If you know the person''s style even a little, it''s hard to go wrong with a classic quilted design in black or a neutral blush.</p>

<h2>How to Make It Feel More Personal</h2>
<ul>
  <li>Pair a mug with their favourite coffee or tea — bought separately, wrapped together</li>
  <li>Add a handwritten note saying why you picked it specifically for them</li>
  <li>Choose a colour you know they wear, not just one you think looks nice</li>
  <li>If you''re unsure on size for clothing, go one up — easier to exchange down</li>
</ul>

<p>The "they don''t need anything" people usually just need someone to notice what they actually use. That''s the whole gift-giving secret.</p>',
   'Stuck on what to buy someone who says they don''t want anything? Practical, everyday items — a good mug, a reliable bag, a quality tee — are the gifts that actually get used.',
   NULL, NULL,
   '["gifts","ideas","seasonal"]',
   'published',
   datetime('now', '-25 days'),
   datetime('now', '-25 days'),
   datetime('now', '-25 days'));

