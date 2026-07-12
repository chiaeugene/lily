-- ─────────────────────────────────────────────────────────────────────────────
-- Lily — Supabase / Postgres schema
-- Run in the Supabase SQL editor. When NEXT_PUBLIC_SUPABASE_URL is set, the app
-- uses these tables instead of the in-memory demo store.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists companies (
  key text primary key,               -- 'prim' | '3c' | 'tien_ngai'
  name text not null,
  reg_no text not null,
  tin_no text,
  formerly_known_as text,
  address_lines text[] not null,
  tel text not null,
  email text not null,
  banks jsonb not null default '[]',   -- [{bank, account}]
  invoice_format text not null,        -- 'running' | 'ym'
  invoice_prefix text not null,
  show_logo boolean default false,
  logo_text text,
  show_qr boolean default false,
  show_lhdn_link boolean default false,
  show_rounding_row boolean default false,
  show_authorised_signature boolean default false
);

create table if not exists customers (
  id text primary key,
  name text not null,
  address_lines text[] not null default '{}',
  tel text,
  fax text
);

create table if not exists products (
  id text primary key,
  name text not null,
  spec_lines text[] not null default '{}',
  uom text not null
);

create table if not exists margin_rules (
  product_id text not null references products(id) on delete cascade,
  tier text not null check (tier in ('tien_ngai','prim','3c')),
  type text not null check (type in ('rm_per_unit','percent')),
  value numeric not null,
  primary key (product_id, tier)
);

create table if not exists orders (
  id text primary key,
  source text not null default 'telegram',
  raw_message text,
  telegram_user text,
  customer_id text references customers(id),
  customer_name text not null,
  customer_address_lines text[] not null default '{}',
  customer_tel text,
  terms text not null default 'C.O.D.',
  date text not null,                  -- dd/MM/yyyy as printed
  lines jsonb not null,                -- OrderLine[]
  status text not null default 'pending', -- pending | verified | rejected
  parse_confidence numeric,
  parse_notes text,
  created_at timestamptz default now()
);

-- Per-company running counters for invoice numbers.
create table if not exists invoice_counters (
  company text primary key references companies(key),
  seq integer not null default 0
);

create table if not exists transactions (
  id text primary key,
  order_id text references orders(id),
  customer_name text not null,
  date text not null,
  grand_total_sell numeric not null,
  margin_captured numeric not null,
  created_at timestamptz default now(),
  status text not null default 'active',        -- active | void            (migration 001)
  void_reason text,
  voided_at timestamptz,
  terms_days integer not null default 0,         -- due-date/aging calc      (migration 003)
  paid_status text not null default 'unpaid' check (paid_status in ('unpaid', 'paid')),
  paid_at timestamptz
);

create table if not exists invoices (
  id text primary key,
  transaction_id text references transactions(id) on delete cascade,
  company text not null references companies(key),
  invoice_no text not null,
  do_no text not null,
  your_ref text default '',
  to_name text not null,
  to_address_lines text[] not null default '{}',
  to_tel text,
  to_fax text,
  terms text not null,
  date text not null,
  lines jsonb not null,                -- InvoiceLine[]
  subtotal numeric not null,
  rounding_adj numeric not null default 0,
  final_total numeric not null,
  amount_in_words text not null
);

create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz default now(),
  actor text not null,
  action text not null,
  detail text
);

-- Purchase orders: Tien Ngai buying raw materials from a supplier. Separate
-- from orders/invoices — one supplier, no margin cascade. Optionally linked
-- to the quotation that prompted the procurement.
create table if not exists purchase_orders (
  id                     text primary key,
  quotation_id           text references orders(id),
  supplier_name          text not null,
  supplier_address_lines text[] not null default '{}',
  supplier_tel           text,
  supplier_fax           text,
  your_ref               text,
  terms                  text not null default '',
  date                   text not null,
  delivery_date          text,
  lines                  jsonb not null,               -- PoLine[]
  status                 text not null default 'draft', -- draft | confirmed | cancelled
  linked_order_id        text references orders(id),
  created_at             timestamptz not null default now(),
  confirmed_at           timestamptz
);

create index if not exists idx_orders_status on orders(status);
create index if not exists idx_invoices_tx on invoices(transaction_id);
create index if not exists idx_invoices_no on invoices(invoice_no);
create index if not exists idx_po_status on purchase_orders(status);
create index if not exists idx_po_quotation on purchase_orders(quotation_id);
create index if not exists idx_tx_customer on transactions(customer_name);
