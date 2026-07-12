-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003 — payment tracking on transactions (unpaid/paid + terms_days
-- for due-date/aging calculations). Additive only, defaults keep existing
-- rows valid ('unpaid', 0 days = due same day).
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table transactions
  add column if not exists terms_days integer not null default 0,
  add column if not exists paid_status text not null default 'unpaid' check (paid_status in ('unpaid', 'paid')),
  add column if not exists paid_at timestamptz;

create index if not exists idx_tx_paid_status on transactions(paid_status);
