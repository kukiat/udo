CREATE TYPE "public"."table_shape" AS ENUM('rect', 'circle');--> statement-breakpoint
CREATE TABLE "floor_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "zone_id" uuid;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "pos_x" integer;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "pos_y" integer;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "width" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "height" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "shape" "table_shape" DEFAULT 'rect' NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "seats" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "rotation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "floor_zones" ADD CONSTRAINT "floor_zones_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "floor_zones_branch_id_idx" ON "floor_zones" USING btree ("branch_id");--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_zone_id_floor_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."floor_zones"("id") ON DELETE set null ON UPDATE no action;