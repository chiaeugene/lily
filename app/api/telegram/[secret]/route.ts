import { NextRequest, NextResponse } from "next/server";
import { parseOrder } from "@/lib/parseOrder";
import { parsePo } from "@/lib/parsePo";
import { transcribeVoice } from "@/lib/transcribe";
import { repo } from "@/lib/repo";
import { fmt2 } from "@/lib/money";
import { todayDDMMYYYY } from "@/lib/store";
import type { Order } from "@/lib/types";

// Keyword-based intent detection, checked at the start of the message so
// everyday chatter in a group doesn't get misread as a document request.
const QUOTE_PREFIX = /^\s*(quote|quotation)\b[:\s]*/i;
const PO_PREFIX = /^\s*(po|purchase\s*order)\b[:\s]*/i;

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
  let text: string = msg?.text ?? "";
  const voice = msg?.voice ?? msg?.audio; // Telegram voice note (or forwarded audio)
  if (!chatId || (!text && !voice)) return NextResponse.json({ ok: true });

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
      "Just type your order, e.g.\n\"68 boxes coreless 57x38x12 to KF Advisor @54.50 cod\"\n\n" +
        "Start a message with \"quote\" to draft a customer quotation instead, e.g.\n\"quote to Daco Petsmart: 1000 rolls thermal paper 80x31 @2.00 cod\"\n\n" +
        "Start with \"po\" to draft a supplier purchase order, e.g.\n\"po to Swan Coatings: 50 kgs FTN 110 ink @19.55\"\n\n" +
        "/order — get a fill-in template\n/id — show your Telegram ID\n\nAfter sending, open the dashboard to verify & generate the 3 invoices.",
    );
    return NextResponse.json({ ok: true });
  }

  // Voice note → transcribe to text (Groq Whisper), then parse like any order.
  let fromVoice = false;
  if (!text && voice?.file_id) {
    const transcript = await transcribeVoice(voice.file_id);
    if (!transcript) {
      if (!isGroup) {
        await reply(
          chatId,
          "🎙 Sorry, I couldn't read that voice message. Please type the order, or record it again clearly.",
        );
      }
      return NextResponse.json({ ok: true });
    }
    text = transcript;
    fromVoice = true;
  }

  // "quote ..." / "quotation ..." → parse as a normal order, but file it as a
  // quotation instead of a pending order.
  if (QUOTE_PREFIX.test(text)) {
    const stripped = text.replace(QUOTE_PREFIX, "");
    const draft = await parseOrder(stripped, msg?.from?.username || userId);
    const hasLine = draft.lines.some((l) => l.qty > 0 && l.productId && !l.productId.startsWith("adhoc-"));
    if (!hasLine) {
      if (!isGroup) await reply(chatId, "I couldn't read a quotation from that. Try:\n\"quote to Daco Petsmart: 1000 rolls thermal paper 80x31 @2.00 cod\"");
      return NextResponse.json({ ok: true });
    }
    const id = await repo.nextQuoteNo();
    const quote: Order = { ...draft, id, source: "quotation", status: "quote" };
    await repo.addQuotation(quote);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const url = appUrl ? `${appUrl}/quotation/${id}` : undefined;
    const lines = quote.lines.map((l) => `• ${l.qty} ${l.uom} ${l.productName} @ RM${fmt2(l.sellUnitPrice)}`).join("\n");
    await reply(
      chatId,
      `📄 Quotation ${id} drafted for ${quote.customerName}\n${lines}${url ? "" : "\n\nOpen the dashboard to review and send it."}`,
      url ? { text: "View quotation", url } : undefined,
    );
    return NextResponse.json({ ok: true });
  }

  // "po ..." / "purchase order ..." → draft a supplier purchase order.
  if (PO_PREFIX.test(text)) {
    const stripped = text.replace(PO_PREFIX, "");
    const draft = await parsePo(stripped);
    if (!draft.lines.some((l) => l.qty > 0)) {
      if (!isGroup) await reply(chatId, "I couldn't read a purchase order from that. Try:\n\"po to Swan Coatings: 50 kgs FTN 110 ink @19.55\"");
      return NextResponse.json({ ok: true });
    }
    const id = await repo.nextPoNo();
    await repo.addPurchaseOrder({
      id,
      supplierName: draft.supplierName,
      supplierAddressLines: [],
      terms: draft.terms || "C.O.D.",
      date: todayDDMMYYYY(),
      deliveryDate: draft.deliveryDate || undefined,
      lines: draft.lines,
      status: "draft",
      createdAt: new Date().toISOString(),
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const url = appUrl ? `${appUrl}/po/${id}` : undefined;
    const lines = draft.lines.map((l) => `• ${l.qty} ${l.uom} ${l.description} @ RM${fmt2(l.unitPrice)}`).join("\n");
    await reply(
      chatId,
      `📦 Purchase order ${id} drafted for ${draft.supplierName}\n${lines}${url ? "" : "\n\nOpen the dashboard to review and send it."}`,
      url ? { text: "View purchase order", url } : undefined,
    );
    return NextResponse.json({ ok: true });
  }

  const order = await parseOrder(text, msg?.from?.username || userId);
  if (fromVoice) order.rawMessage = `🎙 (voice) ${text}`;

  // Anti-chatter guard: only auto-queue when a real catalog product actually
  // matched. In a GROUP this keeps everyday conversation from creating bogus
  // orders — those messages are dropped on purpose. In a PRIVATE chat a
  // message to the bot is virtually always an intentional order attempt, so
  // nothing is ever silently lost: it's still saved as a low-confidence draft
  // for the dashboard to sort out, instead of vanishing if parsing failed.
  const hasRealLine = order.lines.some(
    (l) => l.qty > 0 && l.productId && !l.productId.startsWith("adhoc-"),
  );
  if (!hasRealLine) {
    if (isGroup) return NextResponse.json({ ok: true });

    order.parseNotes = `Low confidence — couldn't confidently match a product/quantity. ${order.parseNotes ?? ""}`.trim();
    await repo.addOrder(order);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const dashUrl = appUrl ? `${appUrl}/dashboard` : undefined;
    await reply(
      chatId,
      `⚠️ I couldn't confidently read that as an order, but I saved it as a draft so nothing's lost — open the dashboard to fix it up, or send /order for the template.`,
      dashUrl ? { text: "Review on dashboard", url: dashUrl } : undefined,
    );
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
