# Lily — your 24/7 back-office

Telegram-to-invoice system for the thermal-paper group. One order in → **three linked
invoices out**, down the supply chain:

```
Telegram order ─▶ Claude parses ─▶ Dashboard verification ─▶ Cascade engine
                                                              │
        ① Prim Paper → 3C Industries   (cost)               │
        ② 3C Industries → Tien Ngai    (+3C margin)          │
        ③ Tien Ngai → Customer         (+Tien Ngai margin)   │
                                                              ▼
                              view / print / save PDFs + audit log
```

The operator enters only the **final sell price**; Lily derives the two upstream prices
from the **margin rules** (per product, per tier, RM/unit or %).

## Stack

- **Next.js** (App Router) — dashboard UI + API routes + Telegram webhook
- **Supabase** — Postgres, Auth, Storage (`supabase/schema.sql`, `supabase/seed.sql`)
- **Render** — hosting
- **Claude API** — natural-language order parsing (Haiku)

## Run it now (demo mode, no keys needed)

```bash
npm install
npm run dev          # http://localhost:3000
npm run test:cascade # verifies the cascade math
```

Without Supabase env vars the app runs on a **seeded in-memory store** — fully clickable:
verify the demo order on the dashboard to generate a real 3-invoice cascade.

## Going live

1. **Supabase**: run `supabase/schema.sql` then `supabase/seed.sql`; put the URL + keys in `.env.local`.
2. **Anthropic**: set `ANTHROPIC_API_KEY` to enable AI parsing (otherwise a heuristic fallback is used).
3. **Telegram**: set `TELEGRAM_BOT_TOKEN`, then point the webhook at this app:
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram/<TELEGRAM_WEBHOOK_SECRET>
   ```
   Restrict who can order with `TELEGRAM_ALLOWED_USER_IDS`.

See `.env.example` for the full list.

## Key files

| Path | Purpose |
|------|---------|
| `lib/cascade.ts` | The engine: one order → three invoices, with derived prices |
| `lib/invoiceHtml.ts` | Pixel-faithful invoice template (per-company skins) |
| `lib/companies.ts` | The three entities, transcribed from the real invoices |
| `lib/money.ts` | Rounding, formatting, Ringgit-in-words |
| `lib/parseOrder.ts` | Claude / heuristic NL order parser |
| `app/(app)/` | Dashboard, Search, Analysis, Records, Settings |
| `app/api/telegram/[secret]/` | Bot webhook |
| `app/api/invoice/[id]/` | Invoice HTML + PDF (browser print) |
