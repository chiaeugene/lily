-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009 — per-user Telegram linking.
--
-- Each user gets a one-time verification code. They send "/start <code>" to
-- the Lily bot from their own Telegram account, which binds their Telegram id
-- to their Lily user — so the bot knows WHO sent a message and therefore WHICH
-- company it belongs to. This is what makes the bot safe to use across many
-- companies instead of assuming a single shared group chat.
--
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table users
  add column if not exists phone text,
  add column if not exists telegram_user_id text,
  add column if not exists telegram_link_code text,
  add column if not exists telegram_linked_at timestamptz;

-- One Telegram account may only be bound to one Lily user.
create unique index if not exists idx_users_telegram_user_id
  on users(telegram_user_id) where telegram_user_id is not null;

create unique index if not exists idx_users_telegram_link_code
  on users(telegram_link_code) where telegram_link_code is not null;
