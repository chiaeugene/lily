-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002 — purchase orders (Tien Ngai buying raw materials from a
-- supplier). Separate from orders/invoices: one supplier, no margin cascade.
-- Optionally linked to the quotation that prompted the procurement; confirming
-- a linked PO spawns the pending sell-order for that quotation.
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

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
  lines                  jsonb not null,
  status                 text not null default 'draft' check (status in ('draft', 'confirmed', 'cancelled')),
  linked_order_id        text references orders(id),
  created_at             timestamptz not null default now(),
  confirmed_at           timestamptz
);

create index if not exists idx_po_status on purchase_orders(status);
create index if not exists idx_po_quotation on purchase_orders(quotation_id);
