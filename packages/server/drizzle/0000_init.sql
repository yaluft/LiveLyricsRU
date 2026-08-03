CREATE TABLE `kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lyric_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lyrics_id` integer NOT NULL,
	`idx` integer NOT NULL,
	`start_ms` integer,
	`end_ms` integer,
	`text` text NOT NULL,
	`romanised` text NOT NULL,
	FOREIGN KEY (`lyrics_id`) REFERENCES `lyrics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lyric_lines_lyrics_idx` ON `lyric_lines` (`lyrics_id`,`idx`);--> statement-breakpoint
CREATE TABLE `lyric_words` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`line_id` integer NOT NULL,
	`idx` integer NOT NULL,
	`start_ms` integer,
	`end_ms` integer,
	`text` text NOT NULL,
	`romanised` text NOT NULL,
	FOREIGN KEY (`line_id`) REFERENCES `lyric_lines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lyric_words_line_idx` ON `lyric_words` (`line_id`,`idx`);--> statement-breakpoint
CREATE TABLE `lyrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`track_id` text NOT NULL,
	`source_id` text NOT NULL,
	`kind` text NOT NULL,
	`timing_kind` text NOT NULL,
	`raw` text NOT NULL,
	`fetched_at` integer NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lyrics_track_source_idx` ON `lyrics` (`track_id`,`source_id`);--> statement-breakpoint
CREATE TABLE `srs_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vocab_entry_id` integer NOT NULL,
	`due` integer NOT NULL,
	`stability` real DEFAULT 0 NOT NULL,
	`difficulty` real DEFAULT 0 NOT NULL,
	`elapsed_days` real DEFAULT 0 NOT NULL,
	`scheduled_days` real DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`state` integer DEFAULT 0 NOT NULL,
	`last_review` integer,
	FOREIGN KEY (`vocab_entry_id`) REFERENCES `vocab_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `srs_cards_entry_idx` ON `srs_cards` (`vocab_entry_id`);--> statement-breakpoint
CREATE INDEX `srs_cards_due_idx` ON `srs_cards` (`due`);--> statement-breakpoint
CREATE TABLE `srs_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`card_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`reviewed_at` integer NOT NULL,
	`duration_ms` integer,
	FOREIGN KEY (`card_id`) REFERENCES `srs_cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `srs_reviews_card_idx` ON `srs_reviews` (`card_id`);--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_id` text NOT NULL,
	`title` text NOT NULL,
	`artist` text DEFAULT '' NOT NULL,
	`album` text,
	`duration_sec` integer DEFAULT 0 NOT NULL,
	`thumb_url` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `translations` (
	`line_hash` text NOT NULL,
	`target_lang` text NOT NULL,
	`text` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`line_hash`, `target_lang`)
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`duration_sec` integer DEFAULT 0 NOT NULL,
	`sha256` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vocab_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lemma` text NOT NULL,
	`surface_form` text NOT NULL,
	`track_id` text,
	`line_id` integer,
	`note` text,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`line_id`) REFERENCES `lyric_lines`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocab_lemma_idx` ON `vocab_entries` (`lemma`);