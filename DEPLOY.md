# Lily — deployment guide

Steps marked **[you]** are manual (accounts/tokens/clicks). **[code]** are done in the repo.

> **Current data mode:** the app runs in **demo mode** (in-memory) and is fully usable,
> but data resets when the server restarts. **Do not issue real invoices** until the
> Supabase persistence layer is wired in code (tracked as the next code task). You can
> still deploy now to validate hosting, login, the bot, and invoice rendering.

---

## 1. GitHub  [you]

The repo is initialized locally with a first commit. Push it to GitHub:

**Option A — GitHub CLI**
```bash
gh auth login            # authenticate once (browser)
gh repo create lily-backoffice --private --source . --push
```

**Option B — web + git**
1. Create a new **private** repo at https://github.com/new named `lily-backoffice` (no README/.gitignore).
2. Then:
```bash
git remote add origin https://github.com/<your-user>/lily-backoffice.git
git push -u origin main
```

---

## 2. Supabase  [you] + [code pending]

1. Create a project at https://supabase.com → **New project** (pick a region close to Malaysia, e.g. Singapore).
2. In the project: **SQL Editor** → paste & run `supabase/schema.sql`, then `supabase/seed.sql`.
3. **Project Settings → API** — copy these for later (Render env vars):
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)

> **[code pending]** The app currently reads/writes the in-memory store. Wiring the
> live Supabase queries (async repo) is the next code task — once your project exists
> we verify it end to end.

---

## 3. Telegram bot  [you]

1. In Telegram, message **@BotFather** → `/newbot` → name it (e.g. "Lily") → get the **bot token**.
2. Save the token for Render → `TELEGRAM_BOT_TOKEN`.
3. (Optional, recommended) restrict who can order: get your numeric Telegram id from **@userinfobot**, set `TELEGRAM_ALLOWED_USER_IDS` (comma-separated). Empty = anyone can order.
4. The webhook is set **after** Render gives you a URL — see step 5.

---

## 4. Render  [you]

1. https://render.com → **New → Web Service** → connect the GitHub repo.
2. Settings:
   - Runtime: **Node**
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Instance: Starter is fine.
3. **Environment** → add variables (from `.env.example`):
   ```
   LILY_PASSCODE=870333
   LILY_AUTH_TOKEN=<any-long-random-string>
   ANTHROPIC_API_KEY=<your key>            # enables AI order parsing
   CLAUDE_PARSER_MODEL=claude-haiku-4-5-20251001
   TELEGRAM_BOT_TOKEN=<from BotFather>
   TELEGRAM_ALLOWED_USER_IDS=<your id>     # optional
   TELEGRAM_WEBHOOK_SECRET=<any-random-slug>
   NEXT_PUBLIC_APP_URL=https://<your-app>.onrender.com
   NEXT_PUBLIC_SUPABASE_URL=<from Supabase>      # once persistence is wired
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase>
   SUPABASE_SERVICE_ROLE_KEY=<from Supabase>
   ```
4. Deploy. Note the public URL, e.g. `https://lily-backoffice.onrender.com`.

---

## 5. Point Telegram at Render  [you]

Once you have the Render URL and `TELEGRAM_WEBHOOK_SECRET`, run (in any terminal):
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-app>.onrender.com/api/telegram/<TELEGRAM_WEBHOOK_SECRET>"
```
Check it: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

Then message the bot: `/start`, then e.g.
`118kg thermal 48gsm 225mm to KF Advisor at 8, cod` → it appears in the dashboard's
**Pending verification** for you to verify & generate the 3 invoices.

---

## 6. First login

Visit the Render URL → landing page → **Sign in** → passcode **870333** (or your `LILY_PASSCODE`).
