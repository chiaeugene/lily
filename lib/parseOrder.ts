// Natural-language order parser. Two paths:
//  1. Structured template (Customer:/Product:/Quantity:/UOM:/Price:/Terms:) — parsed
//     directly with no AI needed; confidence 0.95+.
//  2. Free-form message — sent to Claude (Haiku) for JSON extraction; falls back to
//     a light heuristic when no ANTHROPIC_API_KEY is set.

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

// ── 1. Structured template parser ─────────────────────────────────────────────

/** True when the message looks like our key: value template. */
export function isStructuredTemplate(message: string): boolean {
  return /^\s*customer\s*:/im.test(message) && /^\s*price\s*:/im.test(message);
}

/** Extract a field value from a line like "Customer: KF Advisor". */
function field(message: string, key: string): string {
  const m = message.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)`, "im"));
  return m?.[1]?.trim() ?? "";
}

function parseStructured(
  message: string,
  products: Product[],
  customers: Customer[],
): ParsedDraft {
  const rawCustomer = field(message, "customer");
  const rawProduct  = field(message, "product");
  const rawQty      = field(message, "quantity");
  const rawUom      = field(message, "uom");
  const rawPrice    = field(message, "price");
  const rawTerms    = field(message, "terms");

  const qty   = Number(rawQty.replace(/[^\d.]/g, "")) || 0;
  const price = Number(rawPrice.replace(/[^\d.]/g, "")) || 0;
  const terms = rawTerms || "C.O.D.";

  // fuzzy-match customer (case-insensitive substring)
  const custLower = rawCustomer.toLowerCase();
  const cust = customers.find(
    (c) =>
      c.name.toLowerCase() === custLower ||
      c.name.toLowerCase().includes(custLower) ||
      custLower.includes(c.name.toLowerCase()),
  );

  // fuzzy-match product
  const prodLower = rawProduct.toLowerCase();
  const prod = products.find(
    (p) =>
      p.name.toLowerCase() === prodLower ||
      p.name.toLowerCase().includes(prodLower) ||
      prodLower.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().split(" ").some((w) => w.length > 3 && prodLower.includes(w)),
  );

  const missing: string[] = [];
  if (!rawCustomer) missing.push("Customer");
  if (!rawProduct)  missing.push("Product");
  if (!qty)         missing.push("Quantity");
  if (!price)       missing.push("Price");

  const uom = rawUom.toUpperCase() || prod?.uom || "KGS";

  return {
    customerName: cust?.name ?? (rawCustomer || "UNKNOWN CUSTOMER"),
    terms,
    lines: [
      {
        productName: prod?.name ?? (rawProduct || "UNKNOWN PRODUCT"),
        qty,
        uom,
        sellUnitPrice: price,
        specLines: prod?.specLines ?? [],
      },
    ],
    confidence: missing.length === 0 ? 0.97 : 0.6,
    notes:
      missing.length > 0
        ? `Missing fields: ${missing.join(", ")}. Please check on dashboard.`
        : (!cust
          ? `Customer "${rawCustomer}" not in saved list — will be added as-is.`
          : (!prod
            ? `Product "${rawProduct}" not in catalog — will be added as-is.`
            : undefined)),
  };
}

// ── 2. Claude free-form parser ─────────────────────────────────────────────────

const SYSTEM = `You convert a Malaysian thermal-paper sales order (written in a Telegram message, English or Malay, free-form or structured) into strict JSON.
Return ONLY JSON of shape:
{"customerName": string, "terms": string, "lines":[{"productName": string, "qty": number, "uom": string, "sellUnitPrice": number, "specLines": string[]}], "confidence": number (0..1), "notes": string}
Rules:
- sellUnitPrice is the price charged to the end customer (per unit). Never invent upstream prices.
- uom is usually KGS (thermal paper sold by weight) or BOXES (finished rolls).
- specLines are extra product details like "59.5KG-1ROLL" or "57MMX38MMX12MM".
- terms default "C.O.D." if unspecified.
- confidence: 1.0 if every field is explicit; lower if anything is ambiguous; explain in notes.`;

async function callClaude(
  message: string,
  products: Product[],
  customers: Customer[],
): Promise<ParsedDraft | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.CLAUDE_PARSER_MODEL || "claude-haiku-4-5-20251001";
  const productCtx  = products.map((p) => `${p.name} (uom ${p.uom})`).join("; ");
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

// ── 3. Offline heuristic fallback ─────────────────────────────────────────────

function heuristic(message: string, products: Product[], customers: Customer[]): ParsedDraft {
  const m     = message.toLowerCase();
  const qty   = Number(m.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|box|boxes)/)?.[1] ?? 0);
  const uom   = /box/.test(m) ? "BOXES" : "KGS";
  const price = Number(m.match(/(?:at|@|rm)\s*(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const cust  = customers.find((c) => m.includes(c.name.toLowerCase()));
  const prod  = products.find((p) =>
    p.name.toLowerCase().split(" ").some((w) => w.length > 3 && m.includes(w)),
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

// ── Main export ───────────────────────────────────────────────────────────────

/** Parse a raw Telegram message into a pending Order (not yet persisted). */
export async function parseOrder(message: string, telegramUser?: string): Promise<Order> {
  const [products, customers] = await Promise.all([
    repo.listProducts(),
    repo.listCustomers(),
  ]);

  let draft: ParsedDraft;

  if (isStructuredTemplate(message)) {
    // Fast path — template format, no API call needed
    draft = parseStructured(message, products, customers);
  } else {
    // Free-form — try Claude, fall back to heuristic
    try {
      draft = (await callClaude(message, products, customers)) ?? heuristic(message, products, customers);
    } catch {
      draft = heuristic(message, products, customers);
    }
  }

  const customer = customers.find(
    (c) => c.name.toLowerCase() === draft.customerName.toLowerCase(),
  );
  const lines: OrderLine[] = draft.lines.map((l) => {
    const prod = products.find(
      (p) => p.name.toLowerCase() === l.productName.toLowerCase(),
    );
    return {
      productId:   prod?.id ?? `adhoc-${l.productName.replace(/\s+/g, "-").slice(0, 20)}`,
      productName: prod?.name ?? l.productName,
      specLines:   l.specLines?.length ? l.specLines : prod?.specLines ?? [],
      qty:         l.qty,
      uom:         l.uom ?? prod?.uom ?? "KGS",
      sellUnitPrice: l.sellUnitPrice,
    };
  });

  return {
    id:                  `ord-${Date.now().toString(36)}`,
    source:              "telegram",
    rawMessage:          message,
    telegramUser,
    customerId:          customer?.id,
    customerName:        customer?.name ?? draft.customerName,
    customerAddressLines: customer?.addressLines ?? [],
    customerTel:         customer?.tel,
    terms:               draft.terms ?? "C.O.D.",
    date:                todayDDMMYYYY(),
    lines,
    status:              "pending",
    parseConfidence:     draft.confidence,
    parseNotes:          draft.notes,
    createdAt:           new Date().toISOString(),
  };
}
