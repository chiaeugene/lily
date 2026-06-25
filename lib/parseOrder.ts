// Natural-language order parser. Sends the Telegram message to Claude and gets
// back a structured draft order. Falls back to a light heuristic parser when no
// ANTHROPIC_API_KEY is set, so the bot still works in demo.

import { repo } from "./repo";
import type { Order, OrderLine, Product, Customer } from "./types";
import { todayDDMMYYYY } from "./store";

interface ParsedDraft {
  customerName: string;
  terms?: string;
  lines: { productName: string; qty: number; uom?: string; sellUnitPrice: number; specLines?: string[] }[];
  confidence: number;
  notes?: string;
}

const SYSTEM = `You convert a Malaysian thermal-paper sales order (written casually in a Telegram message, English or Malay) into strict JSON.
Return ONLY JSON of shape:
{"customerName": string, "terms": string, "lines":[{"productName": string, "qty": number, "uom": string, "sellUnitPrice": number, "specLines": string[]}], "confidence": number (0..1), "notes": string}
Rules:
- sellUnitPrice is the price Tien Ngai charges the customer (per unit). Do not invent upstream prices.
- uom is usually KGS (jumbo paper sold by weight) or BOXES (finished rolls).
- specLines are extra product details like "59.5KG-1ROLL" or "57MMX38MMX12MM".
- terms default "C.O.D." if unspecified. Numbers like "8" mean 8.00.
- confidence reflects how sure you are; lower it if anything is ambiguous and explain in notes.`;

async function callClaude(
  message: string,
  products: Product[],
  customers: Customer[],
): Promise<ParsedDraft | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.CLAUDE_PARSER_MODEL || "claude-haiku-4-5-20251001";
  const productCtx = products.map((p) => `${p.name} (uom ${p.uom})`).join("; ");
  const customerCtx = customers.map((c) => c.name).join("; ");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Known products: ${productCtx}\nKnown customers: ${customerCtx}\n\nMessage:\n${message}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = data.content.find((c) => c.type === "text")?.text ?? "";
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json) as ParsedDraft;
}

/** Minimal offline heuristic so the bot works without an API key. */
function heuristic(message: string, products: Product[], customers: Customer[]): ParsedDraft {
  const m = message.toLowerCase();
  const qty = Number(m.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|box|boxes)/)?.[1] ?? 0);
  const uom = /box/.test(m) ? "BOXES" : "KGS";
  const price = Number(m.match(/(?:at|@|rm)\s*(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const cust = customers.find((c) => m.includes(c.name.toLowerCase()));
  const prod = products.find((p) =>
    p.name.toLowerCase().split(" ").some((w) => w.length > 3 && m.includes(w.toLowerCase())),
  );
  return {
    customerName: cust?.name ?? "UNKNOWN CUSTOMER",
    terms: "C.O.D.",
    lines: [
      {
        productName: prod?.name ?? "THERMAL PAPER 48GSM 225MM",
        qty,
        uom: prod?.uom ?? uom,
        sellUnitPrice: price,
        specLines: prod?.specLines ?? [],
      },
    ],
    confidence: cust && prod && qty && price ? 0.8 : 0.4,
    notes: "Parsed offline (no ANTHROPIC_API_KEY). Please verify all fields.",
  };
}

/** Parse a raw message into a pending Order (not yet persisted). */
export async function parseOrder(message: string, telegramUser?: string): Promise<Order> {
  const [products, customers] = await Promise.all([
    repo.listProducts(),
    repo.listCustomers(),
  ]);

  let draft: ParsedDraft;
  try {
    draft = (await callClaude(message, products, customers)) ?? heuristic(message, products, customers);
  } catch {
    draft = heuristic(message, products, customers);
  }

  const customer = customers.find(
    (c) => c.name.toLowerCase() === draft.customerName.toLowerCase(),
  );
  const lines: OrderLine[] = draft.lines.map((l) => {
    const prod = products.find(
      (p) => p.name.toLowerCase() === l.productName.toLowerCase(),
    );
    return {
      productId: prod?.id ?? `adhoc-${l.productName.slice(0, 12)}`,
      productName: prod?.name ?? l.productName,
      specLines: l.specLines?.length ? l.specLines : prod?.specLines ?? [],
      qty: l.qty,
      uom: l.uom ?? prod?.uom ?? "KGS",
      sellUnitPrice: l.sellUnitPrice,
    };
  });

  return {
    id: `ord-${Date.now().toString(36)}`,
    source: "telegram",
    rawMessage: message,
    telegramUser,
    customerId: customer?.id,
    customerName: customer?.name ?? draft.customerName,
    customerAddressLines: customer?.addressLines ?? [],
    customerTel: customer?.tel,
    terms: draft.terms ?? "C.O.D.",
    date: todayDDMMYYYY(),
    lines,
    status: "pending",
    parseConfidence: draft.confidence,
    parseNotes: draft.notes,
    createdAt: new Date().toISOString(),
  };
}
