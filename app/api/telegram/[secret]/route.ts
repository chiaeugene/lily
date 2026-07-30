import { NextRequest, NextResponse } from "next/server";
import { parseOrder } from "@/lib/parseOrder";
import { parsePo } from "@/lib/parsePo";
import { parseExpense } from "@/lib/parseExpense";
import { classifyMessage } from "@/lib/classifyMessage";
import { transcribeVoice } from "@/lib/transcribe";
import { downloadTelegramFile } from "@/lib/telegramFile";
import { addExpense } from "@/lib/expenses";
import { repo } from "@/lib/repo";
import { fmt2 } from "@/lib/money";
import { todayDDMMYYYY } from "@/lib/store";
import type { Order } from "@/lib/types";

// Explicit prefixes still short-circuit straight to the matching flow — the
// fastest, cheapest path, and exactly the old behavior. Anything without one
// goes through AI classification instead of always assuming "sales order",
// since in practice things jump: a forwarded document, a receipt photo, or
// an ad-hoc quote request rarely comes with a tidy prefix attached.
const QUOTE_PREFIX = /^\s*(quote|quotation)\b[:\s]*/i;
const PO_PREFIX = /^\s*(po|purchase\s*order)\b[:\s]*/i;
const EXPENSE_PREFIX = /^\s*(expense|receipt|bill)\b[:\s]*/i;

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
  let text: string = msg?.text ?? msg?.caption ?? "";
  const voice = msg?.voice ?? msg?.audio; // Telegram voice note (or forwarded audio)
  const photos: { file_id: string }[] | undefined = msg?.photo;
  const document = msg?.document as { file_id: string; mime_type?: string } | undefined;
  const hasAttachment = !!(photos?.length || document);
  if (!chatId || (!text && !voice && !hasAttachment)) return NextResponse.json({ ok: true });

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
        "I'll figure out on my own whether it's a customer order, a quotation, a purchase order, or an expense/receipt — " +
        "including from a photo of a receipt or document, no prefix needed. You can still start with " +
        "\"quote\", \"po\", or \"expense\" to force it.\n\n" +
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
    await handleQuote(chatId, text.replace(QUOTE_PREFIX, ""), msg?.from?.username || userId, isGroup);
    return NextResponse.json({ ok: true });
  }

  // "po ..." / "purchase order ..." → draft a supplier purchase order.
  if (PO_PREFIX.test(text)) {
    await handlePo(chatId, text.replace(PO_PREFIX, ""), isGroup);
    return NextResponse.json({ ok: true });
  }

  // "expense ..." / "receipt ..." / "bill ..." → log a business expense.
  if (EXPENSE_PREFIX.test(text)) {
    await handleExpense(chatId, text.replace(EXPENSE_PREFIX, ""), undefined, isGroup);
    return NextResponse.json({ ok: true });
  }

  // No explicit prefix — download any attachment, then let AI decide what
  // kind of document this actually is instead of always assuming "order".
  let image: { base64: string; mime: string } | null = null;
  if (hasAttachment) {
    const fileId = photos?.length ? photos[photos.length - 1].file_id : document?.file_id;
    if (fileId) image = await downloadTelegramFile(fileId);
  }

  if (text.trim() || image) {
    const docType = await classifyMessage(text, image ?? undefined);
    if (docType === "quotation") {
      await handleQuote(chatId, text, msg?.from?.username || userId, isGroup);
      return NextResponse.json({ ok: true });
    }
    if (docType === "purchase_order") {
      await handlePo(chatId, text, isGroup);
      return NextResponse.json({ ok: true });
    }
    if (docType === "expense") {
      await handleExpense(chatId, text, image ?? undefined, isGroup);
      return NextResponse.json({ ok: true });
    }
    // "sales_order" or "unclear" (with no usable text) falls through below —
    // identical to the pre-classification default behavior.
    if (docType === "unclear" && !text.trim()) {
      if (!isGroup) await reply(chatId, "I received your file but couldn't tell what it was — try adding a caption, or use /help.");
      return NextResponse.json({ ok: true });
    }
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

async function handleQuote(chatId: number, text: string, submittedBy: string, isGroup: boolean) {
  const draft = await parseOrder(text, submittedBy);
  const hasLine = draft.lines.some((l) => l.qty > 0 && l.productId && !l.productId.startsWith("adhoc-"));
  if (!hasLine) {
    if (!isGroup) await reply(chatId, "I couldn't read a quotation from that. Try:\n\"quote to Daco Petsmart: 1000 rolls thermal paper 80x31 @2.00 cod\"");
    return;
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
}

async function handlePo(chatId: number, text: string, isGroup: boolean) {
  const draft = await parsePo(text);
  if (!draft.lines.some((l) => l.qty > 0)) {
    if (!isGroup) await reply(chatId, "I couldn't read a purchase order from that. Try:\n\"po to Swan Coatings: 50 kgs FTN 110 ink @19.55\"");
    return;
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
}

async function handleExpense(
  chatId: number,
  text: string,
  image: { base64: string; mime: string } | undefined,
  isGroup: boolean,
) {
  const draft = await parseExpense(text, image);
  if (!(draft.amount > 0) && !image) {
    if (!isGroup) await reply(chatId, "I couldn't read an expense from that. Try:\n\"expense: RM45 diesel for delivery van\", or send a photo of the receipt.");
    return;
  }
  const expense = await addExpense({
    source: "telegram",
    rawMessage: text || undefined,
    documentDataUrl: image ? `data:${image.mime};base64,${image.base64}` : undefined,
    vendorName: draft.vendorName,
    description: draft.description,
    category: draft.category,
    amount: draft.amount,
    date: draft.date,
    parseConfidence: draft.confidence,
    parseNotes: draft.notes,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const url = appUrl ? `${appUrl}/expenses` : undefined;
  await reply(
    chatId,
    `🧾 Expense ${expense.id} drafted — ${expense.vendorName}, RM${fmt2(expense.amount)} (${expense.category})\n` +
      `Awaiting verification before it's counted in P&L.${url ? "" : "\n\nOpen the dashboard to review it."}`,
    url ? { text: "Review & verify", url } : undefined,
  );
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
