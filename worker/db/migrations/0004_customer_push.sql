-- Customer push subscriptions: order-status and back-in-stock alerts for customers
CREATE TABLE IF NOT EXISTS customer_push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  auth TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  order_number TEXT,          -- associated order (nullable: back-in-stock subs)
  customer_email TEXT,        -- optional, for dedup
  customer_phone TEXT,        -- optional, for dedup
  kind TEXT NOT NULL DEFAULT 'order',  -- 'order' | 'restock'
  size_option_id TEXT,        -- non-null when kind='restock'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cps_order_number ON customer_push_subscriptions(order_number);
CREATE INDEX IF NOT EXISTS idx_cps_kind ON customer_push_subscriptions(kind);
CREATE INDEX IF NOT EXISTS idx_cps_size_option ON customer_push_subscriptions(size_option_id);
