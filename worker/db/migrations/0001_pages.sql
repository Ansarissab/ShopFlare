CREATE TABLE `pages` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
