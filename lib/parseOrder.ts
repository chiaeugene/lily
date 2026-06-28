// Natural-language order parser. Two paths:
//  1. Structured template (Customer:/Product:/Quantity:/UOM:/Price:/Terms:) — parsed
//     directly with no AI needed; confidence 0.95+.
//  2. Free-form message — sent to Claude (Haiku) for JSON extraction; falls back to
//     a light heuristic when no ANTHROPIC_API_KEY is set.

import { repo } from "./repo";
import type { Order, OrderLine, Product, Customer } from "./types";
import { todayDDMMYYYY } from "./store";
import { matchProduct } from "./productMatch";

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

  // match product via the shared deterministic matcher (handles shorthand/sizes/ply)
  const prod = matchProduct(rawProduct, products)?.product;

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

const SYSTEM = `You convert a Malaysian paper-products sales order (Telegram message, English or Malay, free-form or structured) into strict JSON.
The seller deals in three families: TISSUE (napkins, jumbo roll tissue, serviette), PAPER ROLLS (thermal receipt rolls, coreless rolls, cash-register/carbonless rolls, printed rolls) and a thermal jumbo master roll.
Return ONLY JSON of shape:
{"customerName": string, "terms": string, "lines":[{"productName": string, "qty": number, "uom": string, "sellUnitPrice": number, "specLines": string[]}], "confidence": number (0..1), "notes": string}
Rules:
- The message may be English, Malay, or Mandarin (e.g. transcribed from a voice note). Understand all three and ALWAYS output productName/customerName in the catalog's English form. Mandarin hints: 热敏纸/感热纸→thermal paper roll; 无芯(热敏)→coreless thermal; 收银纸/收据纸→cash register roll; 双层/2层→2ply, 单层→1ply; 餐巾(纸)→napkin (鸡尾酒→cocktail, 午餐→luncheon, 晚餐→dinner); 大卷纸/卷筒纸→jumbo roll tissue; 餐巾纸(按克)→serviette; 箱→BOXES, 公斤→KGS, 令吉/块→price (RM), 货到付款→C.O.D.
- ALWAYS prefer an exact match from the "Known products" list and copy its full name verbatim into productName. Only invent a name if nothing matches.
- Map shorthand to the known product, e.g.: "5740" or "57x40" -> "...57MM X 40MM"; "5760"/"57x60" -> 57MM X 60MM; "80" or "80x80" thermal -> "THERMAL PAPER ROLL 80MM X 80MM"; "coreless 57" -> "CORELESS...57MM X 38MM X 12MM"; "cocktail 2ply" -> "COCKTAIL NAPKIN 2PLY..."; "luncheon"/"dinner" similarly; "76 2ply"/"carbonless 76" -> "CASH REGISTER ROLL CARBONLESS 76MM X 65MM X 12MM 2PLY (W/Y)"; "76 1ply"/"woodfree 76" -> the HI-WHITE 1PLY one; "jrt" -> "JUMBO ROLL TISSUE"; "48gsm 225" -> "THERMAL PAPER 48GSM 225MM".
- sellUnitPrice is the price charged to the end customer (per unit). Never invent upstream prices.
- uom: use the matched product's own UOM. Generally KGS (thermal jumbo, by weight), BOXES (thermal/coreless/register rolls and napkins), CTN (jumbo roll tissue, serviette).
- specLines are extra product details like "59.5KG-1ROLL", "10 IN 1 PACK", "200R/CTN", "20PKTS X 250'S". Leave [] if none given.
- terms default "C.O.D." if unspecified.
- confidence: 1.0 if every field is explicit and the product matched a known one; lower if anything is ambiguous; explain in notes.`;

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

// Latin + Malaysian-Chinese units. 盒/箱 = box, 公斤/千克 = kg, 卷/条 = roll.
const QTY_UOM = /(\d+(?:\.\d+)?)\s*(kgs?|boxes?|box|ctns?|ctn|rolls?|pkts?|packs?|units?|pcs?|盒|箱|公斤|千克|卷|条|包|件)/i;
// Price: "@8" / "at 8" / "rm 8" / "8块" / "8令吉" / "8元".
const PRICE = /(?:@|at|rm|price[:\s]*)\s*(\d+(?:\.\d+)?)/i;
const CN_PRICE = /(\d+(?:\.\d+)?)\s*(?:块钱?|令吉|元|蚊)/;
// Customer target: English "to X" or Mandarin 给/卖给 X (X = a Latin business name).
const CN_CUST = /(?:卖给|给)\s*([A-Za-z0-9 &.'-]{2,40})/;
const EN_CUST = /\bto\s+([A-Za-z0-9 &.'-]{2,40})/i;

function uomFromWord(w?: string): string | undefined {
  if (!w) return undefined;
  const s = w.toLowerCase();
  if (s.startsWith("kg") || w === "公斤" || w === "千克") return "KGS";
  if (s.startsWith("box") || w === "盒" || w === "箱") return "BOXES";
  if (s.startsWith("ctn")) return "CTN";
  if (s.startsWith("roll") || w === "卷" || w === "条") return "ROLLS";
  return undefined;
}

/**
 * Offline / fallback parser. Handles multi-line orders (one product per line or
 * comma-separated), matching each product with the deterministic matcher.
 */
function heuristic(message: string, products: Product[], customers: Customer[]): ParsedDraft {
  const whole = message.toLowerCase();

  // Customer: a known name anywhere, else the "to/给/卖给 <name>" target.
  const custName =
    customers.find((c) => whole.includes(c.name.toLowerCase()))?.name ??
    (message.match(CN_CUST)?.[1] ?? message.match(EN_CUST)?.[1])?.trim().toUpperCase();
  const terms = "C.O.D.";

  // Split into candidate item fragments: newlines first, then commas. But a
  // single-item order is kept whole (so the product and its quantity stay
  // together even when separated by a comma/clause, e.g. "热敏纸 225mm, 100公斤").
  const qtyCount = (message.match(new RegExp(QTY_UOM.source, "gi")) || []).length;
  const fragments =
    qtyCount <= 1
      ? [message]
      : message
          .split(/\n+/)
          .flatMap((l) => l.split(/,(?=\s*\d)/)) // split on comma only when a qty follows
          .map((s) => s.trim())
          .filter(Boolean);

  const lines: ParsedDraft["lines"] = [];
  for (const frag of fragments) {
    const qm = frag.match(QTY_UOM);
    if (!qm) continue; // a line without a quantity isn't an order item
    const pm = frag.match(PRICE) ?? frag.match(CN_PRICE);
    // strip qty+uom, price and customer tokens so they don't pollute product matching
    const cleaned = frag
      .replace(QTY_UOM, " ")
      .replace(PRICE, " ")
      .replace(CN_PRICE, " ")
      .replace(CN_CUST, " ")
      .replace(EN_CUST, " ");
    const match = matchProduct(cleaned, products);
    if (!match) continue;
    lines.push({
      productName: match.product.name,
      qty: Number(qm[1]),
      uom: uomFromWord(qm[2]) ?? match.product.uom,
      sellUnitPrice: pm ? Number(pm[1]) : 0,
      specLines: match.product.specLines,
    });
  }

  const allPriced = lines.length > 0 && lines.every((l) => l.sellUnitPrice > 0);
  const matched = lines.length > 0;
  return {
    customerName: custName ?? "UNKNOWN CUSTOMER",
    terms,
    lines: matched
      ? lines
      : [{ productName: "UNKNOWN PRODUCT", qty: 0, uom: "BOXES", sellUnitPrice: 0, specLines: [] }],
    confidence: custName && matched && allPriced ? 0.82 : matched ? 0.55 : 0.3,
    notes:
      (matched ? "" : "Could not match any product. ") +
      (custName ? "" : "Customer not recognised. ") +
      (matched && !allPriced ? "Some prices missing. " : "") +
      "Parsed offline — please verify on the dashboard.",
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
    // Exact name match first, then the deterministic matcher (catches AI
    // near-misses and shorthand), using the product's own spec lines as hints.
    const exact = products.find((p) => p.name.toLowerCase() === l.productName.toLowerCase());
    const prod =
      exact ??
      matchProduct(`${l.productName} ${(l.specLines ?? []).join(" ")}`, products)?.product;
    return {
      productId:   prod?.id ?? `adhoc-${l.productName.replace(/\s+/g, "-").slice(0, 20)}`,
      productName: prod?.name ?? l.productName,
      specLines:   l.specLines?.length ? l.specLines : prod?.specLines ?? [],
      qty:         l.qty,
      uom:         l.uom ?? prod?.uom ?? "BOXES",
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
