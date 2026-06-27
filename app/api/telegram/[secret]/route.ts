import { NextRequest, NextResponse } from "next/server";
import { parseOrder } from "@/lib/parseOrder";
import { repo } from "@/lib/repo";
import { fmt2 } from "@/lib/money";

// Telegram webhook. Set it with:
//   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram/<TELEGRAM_WEBHOOK_SECRET>

const ORDER_TEMPLATE = `📋 Copy this template, fill in the blanks, and send:

Customer:
Product:
Quantity:
UOM: KGS
Price:
Terms: C.O.D.

──────────────────
Example:

Customer: KF Advisor
Product: Thermal Paper 48GSM 225MM
Quantity: 118
UOM: KGS
Price: 8.00
Terms: C.O.D.`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  if (secret !== (process.env.TELEGRAM_WEBHOOK_SECRET || "lily-hook")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const update = await req.json().catch(() => null);
  const msg    = update?.message;
  const chatId = msg?.chat?.id;
  const userId = String(msg?.from?.id ?? "");
  const text: string = msg?.text ?? "";
  if (!chatId || !text) return NextResponse.json({ ok: true });

  // Authorisation — OPEN by default so anyone in the order group can submit.
  // Set TELEGRAM_ALLOWED_USER_IDS later to lock down to specific Telegram IDs.
  const allowed = (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length && !allowed.includes(userId)) {
    await reply(chatId, "Sorry, you're not authorised to submit orders.");
    return NextResponse.json({ ok: true });
  }

  const isGroup = msg?.chat?.type === "group" || msg?.chat?.type === "supergroup";

  // /start or /order → send the blank template
  if (text.startsWith("/start") || text.startsWith("/order")) {
    await reply(chatId, ORDER_TEMPLATE);
    return NextResponse.json({ ok: true });
  }

  // /id → reply with the sender's Telegram ID (handy if locking down later)
  if (text.startsWith("/id") || text.startsWith("/whoami")) {
    await reply(chatId, `Your Telegram ID: ${userId}`);
    return NextResponse.json({ ok: true });
  }

  // /help
  if (text.startsWith("/help")) {
    await reply(
      chatId,
      "Just type your order, e.g.\n\"68 boxes coreless 57x38x12 to KF Advisor @54.50 cod\"\n\n/order — get a fill-in template\n/id — show your Telegram ID\n\nAfter sending, open the dashboard to verify & generate the 3 invoices.",
    );
    return NextResponse.json({ ok: true });
  }

  const order = await parseOrder(text, msg?.from?.username || userId);

  // Anti-chatter guard: only queue when a real catalog product actually matched.
  // In a group this keeps everyday conversation from creating bogus orders;
  // in a private chat we nudge the sender toward the right format.
  const hasRealLine = order.lines.some(
    (l) => l.qty > 0 && l.productId && !l.productId.startsWith("adhoc-"),
  );
  if (!hasRealLine) {
    if (!isGroup) {
      await reply(
        chatId,
        "I couldn't read an order from that. Send /order for the template, or e.g.\n\"68 boxes coreless 57x38x12 to KF Advisor @54.50 cod\".",
      );
    }
    return NextResponse.json({ ok: true });
  }

  await repo.addOrder(order);

  const conf  = Math.round((order.parseConfidence ?? 0) * 100);
  const lines = order.lines
    .map((l) => `• ${l.qty} ${l.uom} ${l.productName} @ RM${fmt2(l.sellUnitPrice)}`)
    .join("\n");

  // Deep-link straight to the dashboard so verifying is one tap away.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const dashUrl = appUrl ? `${appUrl}/dashboard` : undefined;

  await reply(
    chatId,
    `✅ Order queued (confidence ${conf}%)\n\nCustomer: ${order.customerName}\n${lines}\nTerms: ${order.terms}${
      order.parseNotes ? `\n\n⚠ ${order.parseNotes}` : ""
    }${dashUrl ? "" : "\n\nOpen the dashboard to verify & generate the 3 invoices."}`,
    dashUrl ? { text: "✓ Verify & generate invoices", url: dashUrl } : undefined,
  );
  return NextResponse.json({ ok: true });
}

/** Send a Telegram message, optionally with a single inline-keyboard button. */
async function reply(chatId: number, text: string, button?: { text: string; url: string }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return; // demo: no token, skip
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (button) {
    body.reply_markup = { inline_keyboard: [[{ text: button.text, url: button.url }]] };
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}
