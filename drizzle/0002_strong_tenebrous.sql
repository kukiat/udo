CREATE INDEX "branches_restaurant_id_idx" ON "branches" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "users_restaurant_id_idx" ON "users" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "users_branch_id_idx" ON "users" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "table_sessions_branch_id_idx" ON "table_sessions" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "table_sessions_table_id_status_idx" ON "table_sessions" USING btree ("table_id","status");--> statement-breakpoint
CREATE INDEX "tables_branch_id_idx" ON "tables" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tables_branch_id_table_number_idx" ON "tables" USING btree ("branch_id","table_number");--> statement-breakpoint
CREATE INDEX "categories_restaurant_id_sort_order_idx" ON "categories" USING btree ("restaurant_id","sort_order");--> statement-breakpoint
CREATE INDEX "kds_stations_branch_id_idx" ON "kds_stations" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "branch_menu_items_branch_id_menu_item_id_idx" ON "branch_menu_items" USING btree ("branch_id","menu_item_id");--> statement-breakpoint
CREATE INDEX "branch_menu_items_menu_item_id_idx" ON "branch_menu_items" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "menu_items_restaurant_id_idx" ON "menu_items" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "menu_items_category_id_idx" ON "menu_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "menu_items_kds_station_id_idx" ON "menu_items" USING btree ("kds_station_id");--> statement-breakpoint
CREATE INDEX "menu_items_status_deleted_at_idx" ON "menu_items" USING btree ("status","deleted_at");--> statement-breakpoint
CREATE INDEX "option_groups_menu_item_id_idx" ON "option_groups" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "option_items_option_group_id_idx" ON "option_items" USING btree ("option_group_id");--> statement-breakpoint
CREATE INDEX "order_item_options_order_item_id_idx" ON "order_item_options" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_item_options_option_item_id_idx" ON "order_item_options" USING btree ("option_item_id");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_menu_item_id_idx" ON "order_items" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "orders_branch_id_status_idx" ON "orders" USING btree ("branch_id","status");--> statement-breakpoint
CREATE INDEX "orders_table_id_status_idx" ON "orders" USING btree ("table_id","status");--> statement-breakpoint
CREATE INDEX "orders_table_session_id_idx" ON "orders" USING btree ("table_session_id");--> statement-breakpoint
CREATE INDEX "orders_branch_id_created_at_idx" ON "orders" USING btree ("branch_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_table_session_id_idx" ON "bills" USING btree ("table_session_id");--> statement-breakpoint
CREATE INDEX "bills_status_idx" ON "bills" USING btree ("status");