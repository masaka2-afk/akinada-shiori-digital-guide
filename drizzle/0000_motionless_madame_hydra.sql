CREATE TABLE `map_sync_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`synced_at` text NOT NULL,
	`spot_count` integer NOT NULL,
	`source_hash` text NOT NULL,
	`last_error` text
);
