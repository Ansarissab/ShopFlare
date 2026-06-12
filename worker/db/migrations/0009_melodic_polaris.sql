CREATE INDEX IF NOT EXISTS `coupon_uses_coupon_id_idx` ON `coupon_uses` (`coupon_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `coupon_uses_order_id_idx` ON `coupon_uses` (`order_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `order_items_order_id_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `orders_created_at_idx` ON `orders` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `orders_stripe_session_id_idx` ON `orders` (`stripe_session_id`);
