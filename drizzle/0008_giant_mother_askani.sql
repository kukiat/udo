ALTER TABLE "table_sessions" ADD COLUMN "party_size" integer;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD COLUMN "seated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD COLUMN "table_note" text;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD COLUMN "customer_name" text;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD COLUMN "customer_phone" text;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD COLUMN "expected_leave_at" timestamp with time zone;