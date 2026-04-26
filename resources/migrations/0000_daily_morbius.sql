CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`addon_id` text NOT NULL,
	`source_ref` text,
	`rom_filename` text NOT NULL,
	`game_name` text,
	`platform_id` integer NOT NULL,
	`collection` text NOT NULL,
	`status` text NOT NULL,
	`progress` real DEFAULT 0 NOT NULL,
	`total_size` integer DEFAULT 0 NOT NULL,
	`imported_size` integer DEFAULT 0 NOT NULL,
	`save_path` text,
	`error` text,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `library_games` (
	`igdb_id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`platforms` text NOT NULL,
	`platforms_short` text NOT NULL,
	`cover_image_id` text,
	`year` integer,
	`developer` text,
	`genre` text,
	`description` text,
	`rating` real,
	`igdb_url` text,
	`igdb_game_type` integer,
	`added_at` text NOT NULL
);
