# RMS Database Diagram

Paste the DBML below into [dbdiagram.io](https://dbdiagram.io) to visualise the schema.

```dbml
// ─── Enums ──────────────────────────────────────────────────────────────────

Enum user_role {
  owner
  admin
  branch_manager
  cashier
  kitchen_staff
  waitstaff
}

Enum table_status {
  available
  occupied
}

Enum session_status {
  active
  closed
}

Enum menu_item_status {
  available
  sold_out
  hidden
}

Enum order_status {
  pending
  preparing
  ready
  served
  completed
  cancelled
}

Enum order_type {
  dine_in
  take_away
}

Enum bill_status {
  open
  requested
  paid
}

Enum payment_method {
  cash
  card
  qr
}

Enum shift_status {
  open
  closed
}

// ─── Tables ─────────────────────────────────────────────────────────────────

Table restaurants {
  id uuid [pk, default: `gen_random_uuid()`]
  name text [not null]
  logo text
  created_at timestamptz [not null, default: `now()`]
}

Table branches {
  id uuid [pk, default: `gen_random_uuid()`]
  restaurant_id uuid [not null, ref: > restaurants.id]
  name text [not null]
  address text
  settings jsonb [not null, default: '{"maxKdsScreens":3,"vatRate":0.07,"serviceChargeRate":0}', note: 'maxKdsScreens, vatRate, serviceChargeRate']
}

Table users {
  id uuid [pk, default: `gen_random_uuid()`]
  email text [not null, unique]
  name text [not null]
  password_hash text [not null]
  role user_role [not null]
  restaurant_id uuid [not null, ref: > restaurants.id]
  branch_id uuid [ref: > branches.id]
  created_at timestamptz [not null, default: `now()`]
}

Table sessions {
  id uuid [pk, default: `gen_random_uuid()`, note: 'doubles as opaque cookie token']
  user_id uuid [not null, ref: > users.id]
  expires_at timestamptz [not null]
  created_at timestamptz [not null, default: `now()`]
}

Table tables {
  id uuid [pk, default: `gen_random_uuid()`]
  branch_id uuid [not null, ref: > branches.id]
  table_number text [not null]
  status table_status [not null, default: 'available']

  indexes {
    (branch_id, table_number) [unique]
  }
}

Table table_sessions {
  id uuid [pk, default: `gen_random_uuid()`]
  branch_id uuid [not null, ref: > branches.id]
  table_id uuid [not null, ref: > tables.id]
  status session_status [not null, default: 'active']
  created_at timestamptz [not null, default: `now()`]
  closed_at timestamptz
}

Table categories {
  id uuid [pk, default: `gen_random_uuid()`]
  restaurant_id uuid [not null, ref: > restaurants.id]
  parent_id uuid [ref: > categories.id, note: 'null = top-level']
  name text [not null]
  sort_order int [not null, default: 0]
  image text
}

Table kds_stations {
  id uuid [pk, default: `gen_random_uuid()`]
  branch_id uuid [not null, ref: > branches.id]
  name text [not null]
  sort_order int [not null, default: 0]
}

Table menu_items {
  id uuid [pk, default: `gen_random_uuid()`]
  restaurant_id uuid [not null, ref: > restaurants.id]
  name text [not null]
  description text
  price numeric(10,2) [not null]
  image text
  category_id uuid [not null, ref: > categories.id]
  kds_station_id uuid [ref: > kds_stations.id]
  status menu_item_status [not null, default: 'available']
  deleted_at timestamptz [note: 'soft delete']
}

Table branch_menu_items {
  id uuid [pk, default: `gen_random_uuid()`]
  branch_id uuid [not null, ref: > branches.id]
  menu_item_id uuid [not null, ref: > menu_items.id]
  price numeric(10,2) [note: 'nullable override']
  is_available boolean [not null, default: true]

  indexes {
    (branch_id, menu_item_id) [unique]
  }
}

Table option_groups {
  id uuid [pk, default: `gen_random_uuid()`]
  menu_item_id uuid [not null, ref: > menu_items.id]
  name text [not null]
  required boolean [not null, default: false]
  min_select int [not null, default: 0]
  max_select int [not null, default: 1]
  sort_order int [not null, default: 0]
}

Table option_items {
  id uuid [pk, default: `gen_random_uuid()`]
  option_group_id uuid [not null, ref: > option_groups.id]
  name text [not null]
  price numeric(10,2) [not null, default: 0]
  sort_order int [not null, default: 0]
}

Table orders {
  id uuid [pk, default: `gen_random_uuid()`]
  branch_id uuid [not null, ref: > branches.id]
  table_id uuid [not null, ref: > tables.id]
  table_session_id uuid [not null, ref: > table_sessions.id]
  order_number text [not null]
  status order_status [not null, default: 'pending']
  type order_type [not null, default: 'dine_in']
  total_amount numeric(10,2) [not null, default: 0]
  created_at timestamptz [not null, default: `now()`]
  cancelled_at timestamptz
  cancel_reason text
}

Table order_items {
  id uuid [pk, default: `gen_random_uuid()`]
  order_id uuid [not null, ref: > orders.id]
  menu_item_id uuid [not null, ref: > menu_items.id]
  quantity int [not null, default: 1]
  unit_price numeric(10,2) [not null]
  note text
}

Table order_item_options {
  id uuid [pk, default: `gen_random_uuid()`]
  order_item_id uuid [not null, ref: > order_items.id]
  option_item_id uuid [not null, ref: > option_items.id]
  price numeric(10,2) [not null, default: 0]
}

Table bills {
  id uuid [pk, default: `gen_random_uuid()`]
  table_session_id uuid [not null, unique, ref: - table_sessions.id]
  subtotal numeric(10,2) [not null, default: 0]
  vat numeric(10,2) [not null, default: 0]
  service_charge numeric(10,2) [not null, default: 0]
  discount numeric(10,2) [not null, default: 0]
  total_amount numeric(10,2) [not null, default: 0]
  status bill_status [not null, default: 'open']
  created_at timestamptz [not null, default: `now()`]
}

Table shifts {
  id uuid [pk, default: `gen_random_uuid()`]
  branch_id uuid [not null, ref: > branches.id]
  cashier_id uuid [not null, ref: > users.id]
  status shift_status [not null, default: 'open']
  opening_float numeric(10,2) [not null, default: 0]
  closing_amount numeric(10,2) [note: 'null while open']
  note text
  opened_at timestamptz [not null, default: `now()`]
  closed_at timestamptz
}

Table payments {
  id uuid [pk, default: `gen_random_uuid()`]
  bill_id uuid [not null, ref: > bills.id]
  shift_id uuid [ref: > shifts.id]
  cashier_id uuid [ref: > users.id]
  method payment_method [not null]
  amount numeric(10,2) [not null]
  tendered numeric(10,2) [note: 'cash: amount handed over']
  change numeric(10,2) [note: 'cash: change returned']
  created_at timestamptz [not null, default: `now()`]
}
```
