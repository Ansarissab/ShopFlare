CREATE TABLE `featured_products` (
	`product_id` text PRIMARY KEY NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `landing_content` (
	`section_key` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`heading` text,
	`subtext` text,
	`body_html` text,
	`cta_text` text,
	`cta_href` text,
	`image_r2_key` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `landing_content` (`section_key`, `enabled`) VALUES
  ('hero',     1),
  ('story',    1),
  ('featured', 1),
  ('reviews',  1),
  ('cta',      1);
