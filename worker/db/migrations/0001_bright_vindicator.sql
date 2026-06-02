CREATE TABLE `pages` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_coupon_uses` (
	`id` text PRIMARY KEY NOT NULL,
	`coupon_id` text NOT NULL,
	`order_id` text NOT NULL,
	`customer_email` text,
	`customer_phone` text,
	`customer_ip` text,
	`used_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_coupon_uses`("id", "coupon_id", "order_id", "customer_email", "customer_phone", "customer_ip", "used_at") SELECT "id", "coupon_id", "order_id", "customer_email", "customer_phone", "customer_ip", "used_at" FROM `coupon_uses`;--> statement-breakpoint
DROP TABLE `coupon_uses`;--> statement-breakpoint
ALTER TABLE `__new_coupon_uses` RENAME TO `coupon_uses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`value` integer NOT NULL,
	`min_order_cents` integer,
	`max_discount_cents` integer,
	`usage_limit` integer,
	`per_customer_limit` integer DEFAULT 1 NOT NULL,
	`used_count` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`stripe_coupon_id` text,
	`stripe_promotion_code_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_coupons`("id", "code", "type", "value", "min_order_cents", "max_discount_cents", "usage_limit", "per_customer_limit", "used_count", "expires_at", "stripe_coupon_id", "stripe_promotion_code_id", "active", "created_at") SELECT "id", "code", "type", "value", "min_order_cents", "max_discount_cents", "usage_limit", "per_customer_limit", "used_count", "expires_at", "stripe_coupon_id", "stripe_promotion_code_id", "active", "created_at" FROM `coupons`;--> statement-breakpoint
DROP TABLE `coupons`;--> statement-breakpoint
ALTER TABLE `__new_coupons` RENAME TO `coupons`;--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);--> statement-breakpoint
CREATE TABLE `__new_notify_me` (
	`id` text PRIMARY KEY NOT NULL,
	`size_option_id` text NOT NULL,
	`email` text,
	`phone` text,
	`notified` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`size_option_id`) REFERENCES `size_options`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_notify_me`("id", "size_option_id", "email", "phone", "notified", "created_at") SELECT "id", "size_option_id", "email", "phone", "notified", "created_at" FROM `notify_me`;--> statement-breakpoint
DROP TABLE `notify_me`;--> statement-breakpoint
ALTER TABLE `__new_notify_me` RENAME TO `notify_me`;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_method` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text,
	`customer_phone` text,
	`shipping_address` text,
	`subtotal_cents` integer NOT NULL,
	`shipping_cents` integer DEFAULT 0 NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer NOT NULL,
	`coupon_code` text,
	`stripe_session_id` text,
	`stripe_payment_intent_id` text,
	`tracking_number` text,
	`carrier` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "order_number", "status", "payment_method", "customer_name", "customer_email", "customer_phone", "shipping_address", "subtotal_cents", "shipping_cents", "discount_cents", "total_cents", "coupon_code", "stripe_session_id", "stripe_payment_intent_id", "tracking_number", "carrier", "notes", "created_at", "updated_at") SELECT "id", "order_number", "status", "payment_method", "customer_name", "customer_email", "customer_phone", "shipping_address", "subtotal_cents", "shipping_cents", "discount_cents", "total_cents", "coupon_code", "stripe_session_id", "stripe_payment_intent_id", "tracking_number", "carrier", "notes", "created_at", "updated_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`stripe_product_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "name", "description", "active", "stripe_product_id", "created_at", "updated_at") SELECT "id", "name", "description", "active", "stripe_product_id", "created_at", "updated_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
CREATE TABLE `__new_push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint` text NOT NULL,
	`auth` text NOT NULL,
	`p256dh` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_push_subscriptions`("id", "endpoint", "auth", "p256dh", "created_at") SELECT "id", "endpoint", "auth", "p256dh", "created_at" FROM `push_subscriptions`;--> statement-breakpoint
DROP TABLE `push_subscriptions`;--> statement-breakpoint
ALTER TABLE `__new_push_subscriptions` RENAME TO `push_subscriptions`;--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `__new_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`rating` integer NOT NULL,
	`body` text,
	`photo_url` text,
	`photo_r2_key` text,
	`approved` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_reviews`("id", "order_id", "product_id", "customer_name", "rating", "body", "photo_url", "photo_r2_key", "approved", "created_at") SELECT "id", "order_id", "product_id", "customer_name", "rating", "body", "photo_url", "photo_r2_key", "approved", "created_at" FROM `reviews`;--> statement-breakpoint
DROP TABLE `reviews`;--> statement-breakpoint
ALTER TABLE `__new_reviews` RENAME TO `reviews`;--> statement-breakpoint
CREATE TABLE `__new_store_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_store_config`("key", "value", "updated_at") SELECT "key", "value", "updated_at" FROM `store_config`;--> statement-breakpoint
DROP TABLE `store_config`;--> statement-breakpoint
ALTER TABLE `__new_store_config` RENAME TO `store_config`;--> statement-breakpoint
CREATE TABLE `__new_stripe_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`type` text NOT NULL,
	`processed_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_stripe_events`("id", "event_id", "type", "processed_at") SELECT "id", "event_id", "type", "processed_at" FROM `stripe_events`;--> statement-breakpoint
DROP TABLE `stripe_events`;--> statement-breakpoint
ALTER TABLE `__new_stripe_events` RENAME TO `stripe_events`;--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_events_event_id_unique` ON `stripe_events` (`event_id`);