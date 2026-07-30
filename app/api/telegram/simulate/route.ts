import { NextRequest, NextResponse } from "next/server";
import { classifyMessage } from "@/lib/classifyMessage";
import { getSession } from "@/lib/currentUser";

/**
 * Dev harness: runs a message through the SAME classifier the Telegram webhook
 * uses, and reports which flow it would land in — without needing a bot token,
 * a webhook, or a real Telegram account.
 *
 * Classification only. It deliberately does NOT create documents, so you can
 * probe the bot's judgement freely without littering the books with test rows.
 *
 * Super-admin only.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Only the platform admin can use the simulator" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const messages: string[] = Array.isArray(body.messages)
    ? body.messages.filter((m: unknown) => typeof m === "string")
    : typeof body.text === "string"
      ? [body.text]
      : [];
  if (!messages.length) {
    return NextResponse.json({ error: "Provide `text` or `messages: string[]`" }, { status: 400 });
  }

  // Mirrors the prefix short-circuits in the webhook so the simulation matches
  // real behaviour rather than only exercising the AI path.
  const QUOTE = /^\s*(quote|quotation)\b[:\s]*/i;
  const PO = /^\s*(po|purchase\s*order)\b[:\s]*/i;
  const EXPENSE = /^\s*(expense|receipt|bill)\b[:\s]*/i;

  const results = [];
  for (const text of messages) {
    let route: string;
    let via: "prefix" | "ai";
    if (QUOTE.test(text)) {
      route = "quotation";
      via = "prefix";
    } else if (PO.test(text)) {
      route = "purchase_order";
      via = "prefix";
    } else if (EXPENSE.test(text)) {
      route = "expense";
      via = "prefix";
    } else {
      route = await classifyMessage(text);
      via = "ai";
    }
    results.push({ text, route, via, creates: DESTINATION[route] ?? "nothing" });
  }

  return NextResponse.json({ ok: true, tenant: session.tenant.name, results });
}

const DESTINATION: Record<string, string> = {
  quotation: "Quotation (QT-) — a priced offer, nothing owed yet",
  purchase_order: "Purchase Order (PO-) — WE buy from a supplier, money out",
  sales_order: "Pending order — awaiting verification, then becomes invoices",
  expense: "Expense (EX-) — awaiting verification, then a payment voucher",
  unclear: "nothing — bot asks for clarification",
};
