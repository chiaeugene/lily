-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006 — real payment QR per company, and a read-only client portal
-- token per customer. Additive only. Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table companies
  add column if not exists payment_qr_data_url text;

alter table customers
  add column if not exists portal_token text unique;

create index if not exists idx_customers_portal_token on customers(portal_token);
