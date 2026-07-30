-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 010 — document numbers are unique PER COMPANY, not globally.
--
-- Bug this fixes: ids like EX-2607-001, QT-2607-001, PO-2607-001 are generated
-- by counting that company's own existing documents, but the primary keys were
-- global. So the moment a second company created its first expense, it tried to
-- insert EX-2607-001 — which the first company already owned — and the write
-- failed with a duplicate-key error.
--
-- Every business expects its own numbering to start at 001, so the fix is a
-- composite key (tenant_id, id) rather than globally-unique ids.
--
-- Cross-table foreign keys are dropped rather than made composite: the app
-- already resolves these links in code (see lib/journey.ts), and every query
-- is tenant-scoped at lib/scopedDb.ts, so a row can't reference another
-- company's record.
--
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Drop FKs that pin these tables to single-column primary keys ────────────
alter table payslips         drop constraint if exists payslips_payroll_run_id_fkey;
alter table payment_vouchers drop constraint if exists payment_vouchers_expense_id_fkey;
alter table invoices         drop constraint if exists invoices_transaction_id_fkey;
alter table transactions     drop constraint if exists transactions_order_id_fkey;
alter table purchase_orders  drop constraint if exists purchase_orders_quotation_id_fkey;
alter table purchase_orders  drop constraint if exists purchase_orders_linked_order_id_fkey;
alter table orders           drop constraint if exists orders_quotation_id_fkey;

-- ── Re-key on (tenant_id, id) ───────────────────────────────────────────────
alter table orders           drop constraint if exists orders_pkey cascade;
alter table orders           add  constraint orders_pkey primary key (tenant_id, id);

alter table transactions     drop constraint if exists transactions_pkey cascade;
alter table transactions     add  constraint transactions_pkey primary key (tenant_id, id);

alter table invoices         drop constraint if exists invoices_pkey cascade;
alter table invoices         add  constraint invoices_pkey primary key (tenant_id, id);

alter table purchase_orders  drop constraint if exists purchase_orders_pkey cascade;
alter table purchase_orders  add  constraint purchase_orders_pkey primary key (tenant_id, id);

alter table expenses         drop constraint if exists expenses_pkey cascade;
alter table expenses         add  constraint expenses_pkey primary key (tenant_id, id);

alter table payment_vouchers drop constraint if exists payment_vouchers_pkey cascade;
alter table payment_vouchers add  constraint payment_vouchers_pkey primary key (tenant_id, id);

alter table payroll_runs     drop constraint if exists payroll_runs_pkey cascade;
alter table payroll_runs     add  constraint payroll_runs_pkey primary key (tenant_id, id);

alter table payslips         drop constraint if exists payslips_pkey cascade;
alter table payslips         add  constraint payslips_pkey primary key (tenant_id, id);

-- payroll_runs.month was globally unique, which would stop a second company
-- from ever running payroll for the same month.
alter table payroll_runs     drop constraint if exists payroll_runs_month_key;
create unique index if not exists idx_payroll_runs_tenant_month
  on payroll_runs(tenant_id, month);

-- ── Lookup indexes the dropped FKs used to provide ──────────────────────────
create index if not exists idx_invoices_tx        on invoices(tenant_id, transaction_id);
create index if not exists idx_payslips_run_scoped on payslips(tenant_id, payroll_run_id);
create index if not exists idx_vouchers_expense_scoped on payment_vouchers(tenant_id, expense_id);
