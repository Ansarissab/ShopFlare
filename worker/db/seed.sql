-- Bootstrap seed for a fresh store.
-- Populates store_config with the keys GET /api/config/store reads.
-- Merchants edit these later via the Admin Dashboard (Phase 2) — no redeploy.
-- Run AFTER migrations:  pnpm db:seed:local   (or)  pnpm db:seed
--
-- INSERT OR IGNORE so re-running never clobbers values already edited in admin.

INSERT OR IGNORE INTO store_config (key, value) VALUES
  ('storeName',                  'My Store'),
  ('tagline',                    'Quality goods, fair prices'),
  ('whatsappNumber',             ''),               -- e.g. 923001234567 (no +, country code first)
  ('contactEmail',               ''),
  ('currency',                   'PKR'),            -- one of CURRENCIES in src/lib/constants
  ('freeShippingThresholdCents', '0'),             -- 0 = free-shipping bar disabled
  ('flatShippingRateCents',      '0');             -- flat rate when below threshold
