CREATE TABLE `oneday_files` (
	`owner_id` text NOT NULL,
	`file_id` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`type` text NOT NULL,
	`association` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `file_id`)
);
--> statement-breakpoint
CREATE TABLE `oneday_receipts` (
	`owner_id` text NOT NULL,
	`request_id` text NOT NULL,
	`operation` text NOT NULL,
	`request_hash` text NOT NULL,
	`response` text NOT NULL,
	`execution_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `request_id`)
);
--> statement-breakpoint
CREATE TABLE `oneday_records` (
	`owner_id` text NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`payload` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `table_name`, `record_id`)
);
--> statement-breakpoint
CREATE INDEX `oneday_records_list` ON `oneday_records` (`owner_id`,`table_name`,`deleted`,`record_id`);--> statement-breakpoint
CREATE TABLE `oneday_revisions` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
