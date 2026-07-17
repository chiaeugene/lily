-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004 — per-person staff accounts, replacing the single shared
-- passcode. Each staff member gets their own short passcode so actions
-- (verify, void, mark paid, etc.) are attributed to a real name instead of
-- a hardcoded "admin". Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists staff (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  passcode text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_staff_passcode on staff(passcode) where active;

-- Seed the existing shared passcode as the first account so login keeps
-- working immediately after this migration runs. Rename / add more staff
-- from the Settings page afterwards.
insert into staff (name, passcode)
values ('Owner', '870333')
on conflict (passcode) do nothing;
