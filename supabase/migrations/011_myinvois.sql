-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 011 — MyInvois (LHDN e-Invoice) submission state per invoice
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table invoices
  add column if not exists myinvois_status       text,        -- null | 'submitted' | 'valid' | 'invalid'
  add column if not exists myinvois_uid          text,        -- submission uid returned by LHDN
  add column if not exists myinvois_long_id      text,        -- validated document long id
  add column if not exists myinvois_submitted_at timestamptz;
