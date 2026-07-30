import { NextRequest, NextResponse } from "next/server";
import { listUsers } from "@/lib/tenant";
import { setLinkCode } from "@/lib/telegramLink";
import { getSession } from "@/lib/currentUser";

// POST { phone? } -> issue a fresh Telegram connection code for this user,
// and return a ready-to-send onboarding message the admin can copy.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (session.user.role === "staff") {
    return NextResponse.json({ error: "Only an owner or admin can issue connection codes" }, { status: 403 });
  }

  // Scoped to the caller's own company — you can't issue a code for someone
  // else's user by guessing an id.
  const users = await listUsers(session.tenant.id);
  const target = users.find((u) => u.id === id);
  if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;

  const code = await setLinkCode(id, phone);
  const botName = process.env.TELEGRAM_BOT_USERNAME || "";
  const botHandle = botName ? `@${botName.replace(/^@/, "")}` : "the Lily bot";
  const botLink = botName ? `https://t.me/${botName.replace(/^@/, "")}` : "";

  const message =
    `Hi ${target.name}, here's how to connect to Lily — our back-office assistant.\n\n` +
    `1. Open Telegram and search for ${botHandle}${botLink ? `\n   (or tap: ${botLink})` : ""}\n` +
    `2. Send this message:\n   /start ${code}\n\n` +
    `That's it. After that you can just message Lily directly:\n` +
    `• "50 boxes thermal paper 57x40 to ABC Trading @45 cod" — creates an order\n` +
    `• "quote to XYZ: 100 rolls @2.50" — drafts a quotation\n` +
    `• Send a photo of a receipt — logs it as an expense\n\n` +
    `Your login: ${target.email}\n` +
    `Web dashboard: ${process.env.NEXT_PUBLIC_APP_URL || "(your Lily URL)"}\n\n` +
    `This code works once and is just for you — please don't forward it.`;

  return NextResponse.json({ ok: true, code, message });
}
