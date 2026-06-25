-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001 — void / credit-note support on transactions
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table transactions
  add column if not exists status      text not null default 'active',  -- 'active' | 'void'
  add column if not exists void_reason text,
  add column if not exists voided_at   timestamptz;

create index if not exists idx_tx_status on transactions(status);
