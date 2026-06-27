import { NextResponse } from "next/server";

// Gated diagnostic (middleware requires the auth cookie). Reports which
// environment variables are CONFIGURED — booleans only, never the secret
// values — so we can verify go-live readiness (Anthropic key, Telegram bot,
// allow-list, Supabase) without exposing anything sensitive.
export async function GET() {
  const allowlist = (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return NextResponse.json({
    env: process.env.NODE_ENV,
    parsing: {
      anthropicKey: !!process.env.ANTHROPIC_API_KEY, // ← the one you're asking about
      parserModel: process.env.CLAUDE_PARSER_MODEL || "claude-haiku-4-5-20251001 (default)",
    },
    telegram: {
      botToken: !!process.env.TELEGRAM_BOT_TOKEN,
      webhookSecretSet: !!process.env.TELEGRAM_WEBHOOK_SECRET,
      allowlistCount: allowlist.length, // count only, not the ids
    },
    data: {
      supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
    },
  });
}
