CREATE TYPE "public"."reservation_status" AS ENUM('booked', 'seated', 'cancelled', 'no_show');--> statement-breakpoint
ALTER TYPE "public"."table_status" ADD VALUE 'reserved';--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"reserved_by_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"party_size" integer NOT NULL,
	"note" text,
	"reserved_for" timestamp with time zone NOT NULL,
	"status" "reservation_status" DEFAULT 'booked' NOT NULL,
	"session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seated_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_reserved_by_id_users_id_fk" FOREIGN KEY ("reserved_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_session_id_table_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."table_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reservations_table_id_reserved_for_idx" ON "reservations" USING btree ("table_id","reserved_for");--> statement-breakpoint
CREATE INDEX "reservations_branch_id_reserved_for_idx" ON "reservations" USING btree ("branch_id","reserved_for");--> statement-breakpoint
CREATE INDEX "reservations_status_idx" ON "reservations" USING btree ("status");