-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007 — expense capture/verification/payment vouchers (feeds P&L),
-- and a structured quotation link on orders (powers the order journey view).
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table orders
  add column if not exists quotation_id text references orders(id);

create index if not exists idx_orders_quotation_id on orders(quotation_id);

create table if not exists expenses (
  id text primary key,
  source text not null default 'manual',
  raw_message text,
  document_data_url text,
  vendor_name text not null,
  description text not null,
  category text not null default 'Others',
  amount numeric not null default 0,
  date text not null,
  status text not null default 'pending_verification' check (status in ('pending_verification','verified','rejected')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid')),
  parse_confidence numeric,
  parse_notes text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by text
);

create table if not exists payment_vouchers (
  id text primary key,
  expense_id text not null references expenses(id),
  vendor_name text not null,
  amount numeric not null default 0,
  paid_date text not null,
  method text not null default 'Bank Transfer',
  reference text,
  created_at timestamptz not null default now(),
  created_by text not null default 'admin'
);

create index if not exists idx_expenses_status on expenses(status);
create index if not exists idx_expenses_payment_status on expenses(payment_status);
create index if not exists idx_vouchers_expense on payment_vouchers(expense_id);
