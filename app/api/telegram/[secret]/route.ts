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
import { invoiceHtml } from "@/lib/invoiceHtml";
import { buildQuoteInvoice } from "@/lib/quote";
import { buildPoInvoice } from "@/lib/po";
import { renderPdf } from "@/lib/pdf";
import { ensureCompaniesHydrated } from "@/lib/companies";
import { runWithTenant } from "@/lib/tenantScope";
import { redeemLinkCode, findUserByTelegramId } from "@/lib/telegramLink";
import type { Order, PurchaseOrder } from "@/lib/types";
import { getIssuingCompany } from "@/lib/tenantCompanies";

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
  // Trimmed on both sides: a secret pasted into a hosting dashboard very
  // easily carries a trailing space or newline, which made this comparison
  // fail and returned 403 to Telegram — the bot then went completely silent
  // with no clue why. Compared case-sensitively but whitespace-tolerantly.
  const expected = (process.env.TELEGRAM_WEBHOOK_SECRET || "lily-hook").trim();
  if (decodeURIComponent(secret).trim() !== expected) {
    console.error(
      `[telegram] webhook secret mismatch — URL segment ${JSON.stringify(secret)} ` +
        `did not match TELEGRAM_WEBHOOK_SECRET (length ${expected.length}). ` +
        `Re-run /api/setup-webhook to re-register with the current value.`,
    );
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const update = await req.json().catch(() => null);
  const msg = update?.message;
  const chatId = msg?.chat?.id;
  const telegramUserId = String(msg?.from?.id ?? "");
  if (!chatId) return NextResponse.json({ ok: true });

  const rawText: string = msg?.text ?? "";

  // "/start 123456" — bind this Telegram account to a Lily user. This runs
  // BEFORE any tenant is known, since establishing the tenant is its purpose.
  const linkMatch = rawText.match(/^\/start\s+(\d{4,8})\b/);
  if (linkMatch) {
    const linked = await redeemLinkCode(linkMatch[1], telegramUserId);
    await reply(
      chatId,
      linked
        ? `✅ You're connected, ${linked.name}.\n\nYou're now sending to ${linked.tenantName}. ` +
            `Just message me an order, a quotation, a purchase order, or a photo of a receipt — ` +
            `I'll work out which it is.\n\nSend /help any time.`
        : `That code didn't work — it may have already been used or expired. ` +
            `Ask your admin to generate a new one for you.`,
    );
    return NextResponse.json({ ok: true });
  }

  // Every other message: identify the sender, and therefore their company.
  // A webhook carries no session cookie, so without this every tenant-scoped
  // query would (correctly) refuse to run.
  const sender = await findUserByTelegramId(telegramUserId);
  if (!sender) {
    await reply(
      chatId,
      "👋 I don't recognise this Telegram account yet.\n\n" +
        "Ask your admin for your connection code, then send:\n/start YOUR_CODE",
    );
    return NextResponse.json({ ok: true });
  }

  try {
    return await runWithTenant(sender.tenantId, () => handleUpdate(update));
  } catch (e) {
    // Always 200 back to Telegram: a non-200 makes it retry the same update
    // forever. Log the cause and tell the user something went wrong.
    console.error("[telegram] handler threw", String((e as Error)?.stack ?? e));
    await reply(chatId, "Something went wrong on my side handling that. It's been logged.");
    return NextResponse.json({ ok: true });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleUpdate(update: any) {
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
        "/order — get a fill-in template\n/id — show your Telegram ID\n\nAfter sending, open the dashboard to verify & invoice.",
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
    // Deep-link to the verification queue itself. This used to point at
    // /dashboard, so tapping "Verify" from Telegram dropped you on the
    // dashboard (or the login page) instead of the thing you came to review.
    const dashUrl = appUrl ? `${appUrl}/pending` : undefined;
    await reply(
      chatId,
      `⚠️ I couldn't confidently read that as an order, but I saved it as a draft so nothing's lost — open the dashboard to fix it up, or send /order for the template.`,
      dashUrl ? { text: "Review it", url: dashUrl } : undefined,
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
  // Deep-link to the verification queue itself. This used to point at
    // /dashboard, so tapping "Verify" from Telegram dropped you on the
    // dashboard (or the login page) instead of the thing you came to review.
    const dashUrl = appUrl ? `${appUrl}/pending` : undefined;

  await reply(
    chatId,
    `✅ Order queued (confidence ${conf}%)\n\nCustomer: ${order.customerName}\n${lines}\nTerms: ${order.terms}${
      order.parseNotes ? `\n\n⚠ ${order.parseNotes}` : ""
    }${dashUrl ? "" : "\n\nOpen the dashboard to verify & invoice."}`,
    dashUrl ? { text: "✓ Review & verify", url: dashUrl } : undefined,
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
  const caption = `📄 Quotation ${id} for ${quote.customerName}\n${lines}`;

  // Send the actual PDF, not just a link — it's forwardable straight to the customer.
  await ensureCompaniesHydrated();
  const quoteCompany = await getIssuingCompany("quote");
  const sent = await replyDocument(chatId, `${id}.pdf`, invoiceHtml(buildQuoteInvoice(quote, quoteCompany), { docLabel: "QUOTATION", company: quoteCompany }), caption);
  if (!sent) {
    await reply(chatId, caption, url ? { text: "View quotation", url } : undefined);
  }
}

async function handlePo(chatId: number, text: string, isGroup: boolean) {
  const draft = await parsePo(text);
  if (!draft.lines.some((l) => l.qty > 0)) {
    if (!isGroup) await reply(chatId, "I couldn't read a purchase order from that. Try:\n\"po to Swan Coatings: 50 kgs FTN 110 ink @19.55\"");
    return;
  }
  const id = await repo.nextPoNo();
  const po: PurchaseOrder = {
    id,
    supplierName: draft.supplierName,
    supplierAddressLines: [],
    terms: draft.terms || "C.O.D.",
    date: todayDDMMYYYY(),
    deliveryDate: draft.deliveryDate || undefined,
    lines: draft.lines,
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  await repo.addPurchaseOrder(po);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const url = appUrl ? `${appUrl}/po/${id}` : undefined;
  const lines = draft.lines.map((l) => `• ${l.qty} ${l.uom} ${l.description} @ RM${fmt2(l.unitPrice)}`).join("\n");
  const caption = `📦 Purchase order ${id} for ${draft.supplierName}\n${lines}`;

  await ensureCompaniesHydrated();
  const poCompany = await getIssuingCompany("po");
  const html = invoiceHtml(buildPoInvoice(po, poCompany), {
    docLabel: "PURCHASE ORDER",
    deliveryDate: po.deliveryDate,
    hideNotes: true,
    hideQr: true,
    forceSignature: true,
    company: poCompany,
  });
  const sent = await replyDocument(chatId, `${id}.pdf`, html, caption);
  if (!sent) {
    await reply(chatId, caption, url ? { text: "View purchase order", url } : undefined);
  }
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

/**
 * Sends a real PDF file into the chat. Returns false when the PDF couldn't be
 * produced (no Chromium on the host, e.g. Windows dev) so the caller can fall
 * back to a link rather than leaving the user with nothing.
 */
async function replyDocument(
  chatId: number,
  filename: string,
  html: string,
  caption: string,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const pdf = await renderPdf(html);
    if (!pdf) return false;
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", caption);
    form.append("document", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), filename);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
    });
    return res.ok;
  } catch (e) {
    console.error("[telegram] sendDocument failed", String((e as Error)?.message ?? e));
    return false;
  }
}

/** Send a Telegram message, optionally with a single inline-keyboard button. */
async function reply(chatId: number, text: string, button?: { text: string; url: string }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return; // demo: no token, skip
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (button) {
    body.reply_markup = { inline_keyboard: [[{ text: button.text, url: button.url }]] };
  }
  // Previously .catch(() => {}) — which meant a failed send looked identical to
  // a successful one, and "the bot didn't reply" was undebuggable. Log it.
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("[telegram] sendMessage failed", res.status, (await res.text()).slice(0, 300));
    }
  } catch (e) {
    console.error("[telegram] sendMessage threw", String((e as Error)?.message ?? e));
  }
}
