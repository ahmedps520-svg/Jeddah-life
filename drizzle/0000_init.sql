CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`detail` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `categories` (
	`slug` text PRIMARY KEY NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text NOT NULL,
	`tagline_en` text,
	`tagline_ar` text,
	`cover` text,
	`color` text DEFAULT '#127C83' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`show_on_home` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `collection_items` (
	`collection_id` text NOT NULL,
	`place_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`note` text,
	`added_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`collection_id`, `place_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_public` integer DEFAULT false NOT NULL,
	`share_token` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collections_user_idx` ON `collections` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `collections_share_idx` ON `collections` (`share_token`);--> statement-breakpoint
CREATE TABLE `event_saves` (
	`user_id` text NOT NULL,
	`event_id` text NOT NULL,
	`reminded_at` integer,
	`notified_change_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `event_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title_en` text NOT NULL,
	`title_ar` text,
	`description_en` text,
	`description_ar` text,
	`category` text NOT NULL,
	`venue_name` text NOT NULL,
	`venue_name_ar` text,
	`place_id` text,
	`lat` real,
	`lng` real,
	`neighbourhood` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`opening_times` text,
	`opening_times_ar` text,
	`price_min` integer,
	`price_max` integer,
	`price_note` text,
	`is_free` integer,
	`age_restriction` text,
	`ticket_url` text,
	`official_url` text,
	`image` text,
	`origin` text DEFAULT 'admin' NOT NULL,
	`source_name` text,
	`source_url` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`last_verified_at` integer,
	`change_note` text,
	`changed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_idx` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `events_dates_idx` ON `events` (`start_date`,`end_date`);--> statement-breakpoint
CREATE TABLE `hero_slides` (
	`id` text PRIMARY KEY NOT NULL,
	`theme` text NOT NULL,
	`title_en` text NOT NULL,
	`title_ar` text NOT NULL,
	`subtitle_en` text,
	`subtitle_ar` text,
	`image` text NOT NULL,
	`href` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hidden_recommendations` (
	`user_id` text NOT NULL,
	`place_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `place_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`place_id` text,
	`kind` text NOT NULL,
	`query` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `interactions_user_idx` ON `interactions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `itineraries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`date` text,
	`start_time` text,
	`duration_min` integer NOT NULL,
	`group_type` text NOT NULL,
	`group_size` integer NOT NULL,
	`budget` integer,
	`budget_mode` text DEFAULT 'per_person' NOT NULL,
	`interests` text DEFAULT '[]' NOT NULL,
	`transport` text DEFAULT 'car' NOT NULL,
	`start_label` text,
	`start_lat` real,
	`start_lng` real,
	`stops` text DEFAULT '[]' NOT NULL,
	`share_token` text,
	`reminded_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `itineraries_user_idx` ON `itineraries` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `itineraries_share_idx` ON `itineraries` (`share_token`);--> statement-breakpoint
CREATE TABLE `neighbourhoods` (
	`slug` text PRIMARY KEY NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text,
	`intro_en` text,
	`intro_ar` text,
	`practical_en` text,
	`practical_ar` text,
	`center_lat` real NOT NULL,
	`center_lng` real NOT NULL,
	`bbox` text NOT NULL,
	`polygon` text,
	`hero` text,
	`featured` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL,
	`source` text DEFAULT 'osm' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`dedupe_key` text,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe_idx` ON `notifications` (`dedupe_key`);--> statement-breakpoint
CREATE TABLE `place_notes` (
	`user_id` text NOT NULL,
	`place_id` text NOT NULL,
	`body` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `place_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `place_stats` (
	`place_id` text NOT NULL,
	`day` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`saves` integer DEFAULT 0 NOT NULL,
	`plans` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`place_id`, `day`),
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `place_stats_day_idx` ON `place_stats` (`day`);--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_en` text,
	`name_ar` text,
	`category` text NOT NULL,
	`secondary_categories` text DEFAULT '[]' NOT NULL,
	`subcategory` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`occasions` text DEFAULT '[]' NOT NULL,
	`description_en` text,
	`description_ar` text,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`neighbourhood` text,
	`address` text,
	`phone` text,
	`website` text,
	`instagram` text,
	`opening_hours` text,
	`hours_source` text,
	`hours_checked_at` integer,
	`price_min` integer,
	`price_max` integer,
	`price_source` text,
	`price_checked_at` integer,
	`price_level` integer,
	`attributes` text DEFAULT '{}' NOT NULL,
	`facilities` text DEFAULT '[]' NOT NULL,
	`accessibility_note` text,
	`images` text DEFAULT '[]' NOT NULL,
	`brand` text,
	`is_chain` integer DEFAULT false NOT NULL,
	`source` text NOT NULL,
	`source_ref` text,
	`source_detail` text,
	`verification` text DEFAULT 'unverified' NOT NULL,
	`last_verified_at` integer,
	`status` text DEFAULT 'published' NOT NULL,
	`editors_pick` integer DEFAULT false NOT NULL,
	`hidden_gem` integer DEFAULT false NOT NULL,
	`hidden_gem_note_en` text,
	`hidden_gem_note_ar` text,
	`flagged_outdated` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`neighbourhood`) REFERENCES `neighbourhoods`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `places_slug_idx` ON `places` (`slug`);--> statement-breakpoint
CREATE INDEX `places_category_idx` ON `places` (`category`);--> statement-breakpoint
CREATE INDEX `places_hood_idx` ON `places` (`neighbourhood`);--> statement-breakpoint
CREATE INDEX `places_status_idx` ON `places` (`status`);--> statement-breakpoint
CREATE TABLE `plan_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `shared_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `plan_participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plan_comments_plan_idx` ON `plan_comments` (`plan_id`);--> statement-breakpoint
CREATE TABLE `plan_options` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`kind` text NOT NULL,
	`place_id` text,
	`date_value` text,
	`note` text,
	`proposed_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `shared_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposed_by`) REFERENCES `plan_participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plan_options_plan_idx` ON `plan_options` (`plan_id`);--> statement-breakpoint
CREATE TABLE `plan_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`user_id` text,
	`display_name` text NOT NULL,
	`guest_token_hash` text,
	`role` text DEFAULT 'participant' NOT NULL,
	`joined_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `shared_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plan_participants_plan_idx` ON `plan_participants` (`plan_id`);--> statement-breakpoint
CREATE INDEX `plan_participants_user_idx` ON `plan_participants` (`user_id`);--> statement-breakpoint
CREATE TABLE `plan_votes` (
	`option_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`value` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`option_id`, `participant_id`),
	FOREIGN KEY (`option_id`) REFERENCES `plan_options`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `plan_participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key`, `window_start`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`user_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolution` text,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reports_status_idx` ON `reports` (`status`);--> statement-breakpoint
CREATE INDEX `reports_target_idx` ON `reports` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`body` text NOT NULL,
	`visit_date` text,
	`price_assessment` text,
	`spent_per_person` integer,
	`photos` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`moderator_note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_user_place_idx` ON `reviews` (`user_id`,`place_id`);--> statement-breakpoint
CREATE INDEX `reviews_place_idx` ON `reviews` (`place_id`);--> statement-breakpoint
CREATE TABLE `saves` (
	`user_id` text NOT NULL,
	`place_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `place_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saves_place_idx` ON `saves` (`place_id`);--> statement-breakpoint
CREATE TABLE `search_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`query` text NOT NULL,
	`normalized` text NOT NULL,
	`locale` text NOT NULL,
	`results` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `search_log_norm_idx` ON `search_log` (`normalized`);--> statement-breakpoint
CREATE INDEX `search_log_created_idx` ON `search_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `shared_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`organizer_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`budget_per_person` integer,
	`status` text DEFAULT 'planning' NOT NULL,
	`final_date` text,
	`final_stops` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shared_plans_code_idx` ON `shared_plans` (`code`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`place_id` text,
	`name` text NOT NULL,
	`gem_type` text NOT NULL,
	`description` text NOT NULL,
	`tips` text,
	`lat` real,
	`lng` real,
	`neighbourhood` text,
	`photos` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`moderator_note` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `submissions_status_idx` ON `submissions` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`role` text DEFAULT 'user' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`interests` text DEFAULT '[]' NOT NULL,
	`favorite_categories` text DEFAULT '[]' NOT NULL,
	`budget_preference` integer,
	`home_neighbourhood` text,
	`privacy` text DEFAULT '{"profilePublic":false,"showVisited":false,"showReviewsOnProfile":true,"personalize":true}' NOT NULL,
	`notification_prefs` text DEFAULT '{"savedEvents":true,"outingReminders":true,"eventChanges":true,"planInvites":true,"planActivity":true,"promotional":false}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `visits` (
	`user_id` text NOT NULL,
	`place_id` text NOT NULL,
	`visited_on` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `place_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade
);
