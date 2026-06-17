CREATE TABLE `landing_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`template` text DEFAULT 'classic' NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `landing_pages` ("id", "name", "is_active", "sort_order") VALUES ('lp_default', 'Default', 1, 0);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_featured_products` (
	`landing_page_id` text NOT NULL,
	`product_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`landing_page_id`, `product_id`),
	FOREIGN KEY (`landing_page_id`) REFERENCES `landing_pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_featured_products`("landing_page_id", "product_id", "sort_order") SELECT 'lp_default', "product_id", "sort_order" FROM `featured_products`;--> statement-breakpoint
DROP TABLE `featured_products`;--> statement-breakpoint
ALTER TABLE `__new_featured_products` RENAME TO `featured_products`;--> statement-breakpoint
CREATE TABLE `__new_landing_content` (
	`landing_page_id` text NOT NULL,
	`section_key` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`heading` text,
	`subtext` text,
	`body_html` text,
	`cta_text` text,
	`cta_href` text,
	`image_r2_key` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`landing_page_id`, `section_key`),
	FOREIGN KEY (`landing_page_id`) REFERENCES `landing_pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_landing_content`("landing_page_id", "section_key", "enabled", "heading", "subtext", "body_html", "cta_text", "cta_href", "image_r2_key", "updated_at") SELECT 'lp_default', "section_key", "enabled", "heading", "subtext", "body_html", "cta_text", "cta_href", "image_r2_key", "updated_at" FROM `landing_content`;--> statement-breakpoint
DROP TABLE `landing_content`;--> statement-breakpoint
ALTER TABLE `__new_landing_content` RENAME TO `landing_content`;--> statement-breakpoint
PRAGMA foreign_keys=ON;