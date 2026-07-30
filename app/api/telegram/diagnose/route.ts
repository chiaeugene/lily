import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSession } from "@/lib/currentUser";

/**
 * Why isn't the bot replying? Asks Telegram what IT thinks is wrong
 * (getWebhookInfo reports the last delivery error), and separately checks the
 * database columns the linking flow depends on.
 *
 * The token is read server-side and never returned, so this is safe to open
 * in a browser. Super-admin only.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Only the platform admin can run diagnostics" }, { status: 403 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const out: Record<string, unknown> = {
    env: {
      TELEGRAM_BOT_TOKEN: token ? "set" : "MISSING",
      TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET ? "set" : "MISSING (defaults to 'lily-hook')",
      TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || "MISSING (onboarding link will be generic)",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "MISSING",
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? "set" : "MISSING (bot can't classify)",
    },
  };

  // What Telegram thinks of our webhook — last_error_message is the money shot.
  if (token) {
    try {
      const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json());
      out.webhook = info?.result ?? info;
    } catch (e) {
      out.webhook = { error: String((e as Error)?.message ?? e) };
    }
  }

  // Does the linking schema actually exist in THIS database?
  try {
    const { error } = await getSupabaseAdmin()
      .from("users")
      .select("id, telegram_link_code, telegram_user_id")
      .limit(1);
    out.migration009 = error ? { applied: false, error: error.message } : { applied: true };
  } catch (e) {
    out.migration009 = { applied: false, error: String((e as Error)?.message ?? e) };
  }

  // Any codes currently outstanding, and are any accounts already linked?
  try {
    const db = getSupabaseAdmin();
    const { data: pending } = await db
      .from("users")
      .select("email, telegram_link_code")
      .not("telegram_link_code", "is", null);
    const { data: linked } = await db
      .from("users")
      .select("email, telegram_user_id")
      .not("telegram_user_id", "is", null);
    out.codes = {
      outstanding: (pending ?? []).map((u: { email: string; telegram_link_code: string }) => ({
        email: u.email,
        code: u.telegram_link_code,
      })),
      alreadyLinked: (linked ?? []).map((u: { email: string }) => u.email),
    };
  } catch (e) {
    out.codes = { error: String((e as Error)?.message ?? e) };
  }

  return NextResponse.json(out);
}
