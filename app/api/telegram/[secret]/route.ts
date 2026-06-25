import { NextRequest, NextResponse } from "next/server";
import { parseOrder } from "@/lib/parseOrder";
import { repo } from "@/lib/repo";
import { fmt2 } from "@/lib/money";

// Telegram webhook. Set it with:
//   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram/<TELEGRAM_WEBHOOK_SECRET>
export async function POST(req: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  if (secret !== (process.env.TELEGRAM_WEBHOOK_SECRET || "lily-hook")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const update = await req.json().catch(() => null);
  const msg = update?.message;
  const chatId = msg?.chat?.id;
  const userId = String(msg?.from?.id ?? "");
  const text: string = msg?.text ?? "";
  if (!chatId || !text) return NextResponse.json({ ok: true });

  // allow-list check
  const allowed = (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length && !allowed.includes(userId)) {
    await reply(chatId, "Sorry, you're not authorised to submit orders.");
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith("/start")) {
    await reply(
      chatId,
      "👋 Hi, I'm Lily. Send me an order in plain language, e.g.\n\n“118kg thermal 48gsm 225mm to KF Advisor at 8, cod”\n\nI'll parse it and queue it for verification on the dashboard.",
    );
    return NextResponse.json({ ok: true });
  }

  const order = await parseOrder(text, msg?.from?.username || userId);
  await repo.addOrder(order);

  const conf = Math.round((order.parseConfidence ?? 0) * 100);
  const lines = order.lines
    .map((l) => `• ${l.qty} ${l.uom} ${l.productName} @ RM${fmt2(l.sellUnitPrice)}`)
    .join("\n");
  await reply(
    chatId,
    `📝 Order queued (AI confidence ${conf}%)\n\nCustomer: ${order.customerName}\n${lines}\nTerms: ${order.terms}\n\n${
      order.parseNotes ? "⚠ " + order.parseNotes + "\n\n" : ""
    }Open the dashboard to verify & generate the 3 invoices.`,
  );
  return NextResponse.json({ ok: true });
}

async function reply(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return; // demo: no token, skip outbound
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {});
}
