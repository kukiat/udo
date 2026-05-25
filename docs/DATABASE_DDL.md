# RMS Database DDL

PostgreSQL schema for the RMS (Self-Order, KDS & Menu Management) system, consolidated from the Drizzle migrations under `drizzle/`. This reflects the final state after migrations `0000`–`0004`.

## Enums

```sql
CREATE TYPE "public"."bill_status"       AS ENUM ('open', 'requested', 'paid');
CREATE TYPE "public"."menu_item_status"  AS ENUM ('available', 'sold_out', 'hidden');
CREATE TYPE "public"."order_status"      AS ENUM ('pending', 'preparing', 'ready', 'served', 'completed', 'cancelled');
CREATE TYPE "public"."order_type"        AS ENUM ('dine_in', 'take_away');
CREATE TYPE "public"."session_status"    AS ENUM ('active', 'closed');
CREATE TYPE "public"."table_status"      AS ENUM ('available', 'occupied');
CREATE TYPE "public"."user_role"         AS ENUM ('owner', 'admin', 'branch_manager', 'cashier', 'kitchen_staff', 'waitstaff');
CREATE TYPE "public"."payment_method"    AS ENUM ('cash', 'card', 'qr');
CREATE TYPE "public"."shift_status"      AS ENUM ('open', 'closed');
```

## Tables

```sql
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"logo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"settings" jsonb DEFAULT '{"maxKdsScreens":3,"vatRate":0.07,"serviceChargeRate":0}'::jsonb NOT NULL
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"branch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"table_number" text NOT NULL,
	"status" "table_status" DEFAULT 'available' NOT NULL
);

CREATE TABLE "table_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);

CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"image" text
);

CREATE TABLE "kds_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"image" text,
	"category_id" uuid NOT NULL,
	"kds_station_id" uuid,
	"status" "menu_item_status" DEFAULT 'available' NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE TABLE "branch_menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"price" numeric(10, 2),
	"is_available" boolean DEFAULT true NOT NULL
);

CREATE TABLE "option_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"name" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"min_select" integer DEFAULT 0 NOT NULL,
	"max_select" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "option_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option_group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"table_session_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"type" "order_type" DEFAULT 'dine_in' NOT NULL,
	"total_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text
);

CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"note" text
);

CREATE TABLE "order_item_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"option_item_id" uuid NOT NULL,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL
);

CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_session_id" uuid NOT NULL,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"vat" numeric(10, 2) DEFAULT '0' NOT NULL,
	"service_charge" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" "bill_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"cashier_id" uuid NOT NULL,
	"status" "shift_status" DEFAULT 'open' NOT NULL,
	"opening_float" numeric(10, 2) DEFAULT '0' NOT NULL,
	"closing_amount" numeric(10, 2),
	"note" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);

CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"shift_id" uuid,
	"cashier_id" uuid,
	"method" "payment_method" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"tendered" numeric(10, 2),
	"change" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

## Foreign Keys

```sql
ALTER TABLE "branches" ADD CONSTRAINT "branches_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "users" ADD CONSTRAINT "users_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "tables" ADD CONSTRAINT "tables_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "categories" ADD CONSTRAINT "categories_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "kds_stations" ADD CONSTRAINT "kds_stations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_kds_station_id_kds_stations_id_fk" FOREIGN KEY ("kds_station_id") REFERENCES "public"."kds_stations"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "branch_menu_items" ADD CONSTRAINT "branch_menu_items_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "branch_menu_items" ADD CONSTRAINT "branch_menu_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "option_groups" ADD CONSTRAINT "option_groups_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "option_items" ADD CONSTRAINT "option_items_option_group_id_option_groups_id_fk" FOREIGN KEY ("option_group_id") REFERENCES "public"."option_groups"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_session_id_table_sessions_id_fk" FOREIGN KEY ("table_session_id") REFERENCES "public"."table_sessions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_option_item_id_option_items_id_fk" FOREIGN KEY ("option_item_id") REFERENCES "public"."option_items"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "bills" ADD CONSTRAINT "bills_table_session_id_table_sessions_id_fk" FOREIGN KEY ("table_session_id") REFERENCES "public"."table_sessions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "payments" ADD CONSTRAINT "payments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payments" ADD CONSTRAINT "payments_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "payments" ADD CONSTRAINT "payments_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
```

## Indexes

```sql
CREATE INDEX "branches_restaurant_id_idx" ON "branches" USING btree ("restaurant_id");

CREATE INDEX "users_restaurant_id_idx" ON "users" USING btree ("restaurant_id");
CREATE INDEX "users_branch_id_idx" ON "users" USING btree ("branch_id");

CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");

CREATE INDEX "tables_branch_id_idx" ON "tables" USING btree ("branch_id");
CREATE UNIQUE INDEX "tables_branch_id_table_number_idx" ON "tables" USING btree ("branch_id","table_number");

CREATE INDEX "table_sessions_branch_id_idx" ON "table_sessions" USING btree ("branch_id");
CREATE INDEX "table_sessions_table_id_status_idx" ON "table_sessions" USING btree ("table_id","status");

CREATE INDEX "categories_restaurant_id_sort_order_idx" ON "categories" USING btree ("restaurant_id","sort_order");
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");

CREATE INDEX "kds_stations_branch_id_idx" ON "kds_stations" USING btree ("branch_id");

CREATE INDEX "menu_items_restaurant_id_idx" ON "menu_items" USING btree ("restaurant_id");
CREATE INDEX "menu_items_category_id_idx" ON "menu_items" USING btree ("category_id");
CREATE INDEX "menu_items_kds_station_id_idx" ON "menu_items" USING btree ("kds_station_id");
CREATE INDEX "menu_items_status_deleted_at_idx" ON "menu_items" USING btree ("status","deleted_at");

CREATE UNIQUE INDEX "branch_menu_items_branch_id_menu_item_id_idx" ON "branch_menu_items" USING btree ("branch_id","menu_item_id");
CREATE INDEX "branch_menu_items_menu_item_id_idx" ON "branch_menu_items" USING btree ("menu_item_id");

CREATE INDEX "option_groups_menu_item_id_idx" ON "option_groups" USING btree ("menu_item_id");
CREATE INDEX "option_items_option_group_id_idx" ON "option_items" USING btree ("option_group_id");

CREATE INDEX "orders_branch_id_status_idx" ON "orders" USING btree ("branch_id","status");
CREATE INDEX "orders_table_id_status_idx" ON "orders" USING btree ("table_id","status");
CREATE INDEX "orders_table_session_id_idx" ON "orders" USING btree ("table_session_id");
CREATE INDEX "orders_branch_id_created_at_idx" ON "orders" USING btree ("branch_id","created_at");

CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");
CREATE INDEX "order_items_menu_item_id_idx" ON "order_items" USING btree ("menu_item_id");

CREATE INDEX "order_item_options_order_item_id_idx" ON "order_item_options" USING btree ("order_item_id");
CREATE INDEX "order_item_options_option_item_id_idx" ON "order_item_options" USING btree ("option_item_id");

CREATE UNIQUE INDEX "bills_table_session_id_idx" ON "bills" USING btree ("table_session_id");
CREATE INDEX "bills_status_idx" ON "bills" USING btree ("status");

CREATE INDEX "shifts_branch_id_status_idx" ON "shifts" USING btree ("branch_id","status");
CREATE INDEX "shifts_cashier_id_idx" ON "shifts" USING btree ("cashier_id");

CREATE INDEX "payments_bill_id_idx" ON "payments" USING btree ("bill_id");
CREATE INDEX "payments_shift_id_idx" ON "payments" USING btree ("shift_id");
```
