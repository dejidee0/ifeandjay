CREATE TABLE `guest_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guest_name` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rsvps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guest_name` text NOT NULL,
	`contact` text NOT NULL,
	`attendance` text NOT NULL,
	`guest_count` integer DEFAULT 1 NOT NULL,
	`confirmation_code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rsvps_confirmation_code_unique` ON `rsvps` (`confirmation_code`);