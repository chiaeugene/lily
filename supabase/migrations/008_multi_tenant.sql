-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008 — MULTI-TENANT. Turns Lily from a single-business tool into a
-- platform many businesses can use, each seeing only their own data.
--
-- Model:
--   tenant   = a business using Lily (the platform's customer)
--   company  = an invoicing entity belonging to a tenant
--              (most tenants have 1; the Tien Ngai group has 3 for its cascade)
--
-- All existing data is preserved and assigned to the "tien-ngai" tenant.
-- No credentials are seeded here — the super-admin user is bootstrapped from
-- LILY_ADMIN_EMAIL / LILY_ADMIN_PASSWORD env vars on first login attempt, so
-- no password material is ever committed to the repo.
--
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tenants ──────────────────────────────────────────────────────────────────
create table if not exists tenants (
  id text primary key,
  name text not null,
  slug text unique not null,
  -- The 3-invoice cascade is a Tien-Ngai-specific capability, not a default.
  cascade_enabled boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into tenants (id, name, slug, cascade_enabled)
values ('tien-ngai', 'Tien Ngai Machinery Group', 'tien-ngai', true)
on conflict (id) do nothing;

-- ── Users (email + password, replaces the shared passcode) ────────────────────
create table if not exists users (
  id text primary key default gen_random_uuid()::text,
  tenant_id text references tenants(id),
  email text not null unique,
  password_hash text not null,
  name text not null,
  -- super_admin: platform owner, may switch between tenants
  -- owner:       runs one tenant, can add that tenant's staff
  -- staff:       day-to-day user of one tenant
  role text not null default 'owner' check (role in ('super_admin','owner','staff')),
  active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_tenant on users(tenant_id);
create index if not exists idx_users_email on users(email) where active;

-- ── Invite codes (Telegram self-serve onboarding) ────────────────────────────
create table if not exists invite_codes (
  code text primary key,
  label text,
  created_by text,
  used_by_tenant_id text references tenants(id),
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Tenant scoping on every data table ───────────────────────────────────────
alter table companies         add column if not exists tenant_id text references tenants(id);
alter table customers         add column if not exists tenant_id text references tenants(id);
alter table products          add column if not exists tenant_id text references tenants(id);
alter table margin_rules      add column if not exists tenant_id text references tenants(id);
alter table orders            add column if not exists tenant_id text references tenants(id);
alter table transactions      add column if not exists tenant_id text references tenants(id);
alter table invoices          add column if not exists tenant_id text references tenants(id);
alter table purchase_orders   add column if not exists tenant_id text references tenants(id);
alter table invoice_counters  add column if not exists tenant_id text references tenants(id);
alter table audit_log         add column if not exists tenant_id text references tenants(id);
alter table staff             add column if not exists tenant_id text references tenants(id);
alter table employees         add column if not exists tenant_id text references tenants(id);
alter table payroll_runs      add column if not exists tenant_id text references tenants(id);
alter table payslips          add column if not exists tenant_id text references tenants(id);
alter table expenses          add column if not exists tenant_id text references tenants(id);
alter table payment_vouchers  add column if not exists tenant_id text references tenants(id);

-- ── Backfill: every existing row belongs to the Tien Ngai group ──────────────
update companies        set tenant_id = 'tien-ngai' where tenant_id is null;
update customers        set tenant_id = 'tien-ngai' where tenant_id is null;
update products         set tenant_id = 'tien-ngai' where tenant_id is null;
update margin_rules     set tenant_id = 'tien-ngai' where tenant_id is null;
update orders           set tenant_id = 'tien-ngai' where tenant_id is null;
update transactions     set tenant_id = 'tien-ngai' where tenant_id is null;
update invoices         set tenant_id = 'tien-ngai' where tenant_id is null;
update purchase_orders  set tenant_id = 'tien-ngai' where tenant_id is null;
update invoice_counters set tenant_id = 'tien-ngai' where tenant_id is null;
update audit_log        set tenant_id = 'tien-ngai' where tenant_id is null;
update staff            set tenant_id = 'tien-ngai' where tenant_id is null;
update employees        set tenant_id = 'tien-ngai' where tenant_id is null;
update payroll_runs     set tenant_id = 'tien-ngai' where tenant_id is null;
update payslips         set tenant_id = 'tien-ngai' where tenant_id is null;
update expenses         set tenant_id = 'tien-ngai' where tenant_id is null;
update payment_vouchers set tenant_id = 'tien-ngai' where tenant_id is null;

-- ── Company keys are only unique WITHIN a tenant ─────────────────────────────
-- Another tenant must be able to have its own company; the old single-column
-- primary key on companies.key prevented that. Invoices/counters keep a plain
-- `company` text column and are matched per-tenant in the app layer.
alter table invoice_counters drop constraint if exists invoice_counters_company_fkey;
alter table invoices         drop constraint if exists invoices_company_fkey;
alter table companies        drop constraint if exists companies_pkey cascade;
alter table companies        add  constraint companies_pkey primary key (tenant_id, key);

alter table invoice_counters drop constraint if exists invoice_counters_pkey cascade;
alter table invoice_counters add  constraint invoice_counters_pkey primary key (tenant_id, company);

-- ── Scoping indexes ──────────────────────────────────────────────────────────
create index if not exists idx_customers_tenant       on customers(tenant_id);
create index if not exists idx_products_tenant        on products(tenant_id);
create index if not exists idx_orders_tenant          on orders(tenant_id);
create index if not exists idx_transactions_tenant    on transactions(tenant_id);
create index if not exists idx_invoices_tenant        on invoices(tenant_id);
create index if not exists idx_purchase_orders_tenant on purchase_orders(tenant_id);
create index if not exists idx_staff_tenant           on staff(tenant_id);
create index if not exists idx_employees_tenant       on employees(tenant_id);
create index if not exists idx_expenses_tenant        on expenses(tenant_id);
create index if not exists idx_vouchers_tenant        on payment_vouchers(tenant_id);
