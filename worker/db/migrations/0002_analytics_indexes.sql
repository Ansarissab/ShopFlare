CREATE INDEX `order_items_order_id_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_items_product_id_idx` ON `order_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `analytics_daily` (
	`date` text NOT NULL,
	`metric` text NOT NULL,
	`count` integer NOT NULL DEFAULT 0,
	PRIMARY KEY (`date`, `metric`)
);--> statement-breakpoint
CREATE TABLE `carts` (
	`session_id` text PRIMARY KEY NOT NULL,
	`items` text NOT NULL,
	`updated_at` text NOT NULL DEFAULT (datetime('now')),
	`recovered` integer NOT NULL DEFAULT 0
);
