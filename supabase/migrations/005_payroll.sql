-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005 — payroll: employees + payroll runs/payslips.
-- This only calculates and records pay; it never moves money. EPF/SOCSO/EIS
-- figures are computed with standard flat-rate approximations at the app
-- layer — verify against the official KWSP/PERKESO/LHDN tables (or your
-- accountant) before relying on this for a real payroll run.
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists employees (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  ic_no text,
  position text,
  bank_name text,
  bank_account text,
  epf_no text,
  socso_no text,
  basic_salary numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists payroll_runs (
  id text primary key,           -- "PR-2607"
  month text not null unique,    -- "2026-07"
  created_at timestamptz not null default now()
);

create table if not exists payslips (
  id text primary key,
  payroll_run_id text not null references payroll_runs(id) on delete cascade,
  employee_id text not null references employees(id),
  employee_name text not null,   -- snapshot at run time, survives employee edits
  basic_salary numeric not null default 0,
  allowances numeric not null default 0,
  deductions numeric not null default 0,
  epf_employee numeric not null default 0,
  epf_employer numeric not null default 0,
  socso_employee numeric not null default 0,
  socso_employer numeric not null default 0,
  eis_employee numeric not null default 0,
  eis_employer numeric not null default 0,
  pcb numeric not null default 0,
  net_pay numeric not null default 0,
  paid_status text not null default 'unpaid' check (paid_status in ('unpaid', 'paid')),
  paid_at timestamptz
);

create index if not exists idx_payslips_run on payslips(payroll_run_id);
create index if not exists idx_employees_active on employees(active);
