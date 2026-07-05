// Natural-language purchase-order parser — for Tien Ngai buying raw materials
// from an external supplier. Unlike parseOrder.ts there's no product catalog to
// match against (raw materials aren't finished-goods SKUs), so this is simpler:
// Claude (if configured) extracts free-form fields, else a light heuristic.

import { todayDDMMYYYY } from "./store";
import type { PoLine } from "./types";

export interface ParsedPoDraft {
  supplierName: string;
  terms?: string;
  deliveryDate?: string;
  lines: PoLine[];
  confidence: number;
  notes?: string;
}

const SYSTEM = `You convert a free-form message requesting a purchase order (Telegram message, English or Malay) into strict JSON.
The buyer (Tien Ngai Machinery) is ordering raw materials or services from an external supplier — e.g. ink, coating, paper reels, or similar.
Return ONLY JSON of shape:
{"supplierName": string, "terms": string, "deliveryDate": string, "lines":[{"description": string, "uom": string, "qty": number, "unitPrice": number}], "confidence": number (0..1), "notes": string}
Rules:
- supplierName: who we are buying from (e.g. "to Swan Coatings" / "from Swan Coatings" -> "SWAN COATINGS").
- deliveryDate: dd/MM/yyyy if a date is mentioned, else "".
- terms default "C.O.D." if unspecified.
- lines: one entry per distinct item, with its own qty/uom/unitPrice. uom examples: KGS, ROLLS, UNIT, LITER.
- confidence: 1.0 if supplier + all items are explicit; lower if anything is ambiguous; explain in notes.`;

async function callClaude(message: string): Promise<ParsedPoDraft | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.CLAUDE_PARSER_MODEL || "claude-haiku-4-5-20251001";
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
      messages: [{ role: "user", content: message }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = data.content.find((c) => c.type === "text")?.text ?? "";
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json) as ParsedPoDraft;
}

const QTY_UOM = /(\d+(?:\.\d+)?)\s*(kgs?|rolls?|units?|pcs?|liters?|litres?|boxes?|box|ctns?|ctn)/i;
const PRICE = /(?:@|at|rm|price[:\s]*)\s*(\d+(?:\.\d+)?)/i;
const SUPPLIER = /\b(?:to|from)\s+([A-Za-z0-9 &.'-]{2,40})/i;

function uomFromWord(w?: string): string {
  if (!w) return "UNIT";
  const s = w.toLowerCase();
  if (s.startsWith("kg")) return "KGS";
  if (s.startsWith("roll")) return "ROLLS";
  if (s.startsWith("box")) return "BOXES";
  if (s.startsWith("ctn")) return "CTN";
  if (s.startsWith("liter") || s.startsWith("litre")) return "LITER";
  return "UNIT";
}

function heuristic(message: string): ParsedPoDraft {
  const supplierName = message.match(SUPPLIER)?.[1]?.trim().toUpperCase();

  const qtyCount = (message.match(new RegExp(QTY_UOM.source, "gi")) || []).length;
  const fragments =
    qtyCount <= 1
      ? [message]
      : message
          .split(/\n+/)
          .flatMap((l) => l.split(/,(?=\s*\d)/))
          .map((s) => s.trim())
          .filter(Boolean);

  const lines: PoLine[] = [];
  for (const frag of fragments) {
    const qm = frag.match(QTY_UOM);
    if (!qm) continue;
    const pm = frag.match(PRICE);
    const description = frag
      .replace(QTY_UOM, " ")
      .replace(PRICE, " ")
      .replace(SUPPLIER, " ")
      .replace(/[,.]/g, " ")
      .trim()
      .toUpperCase();
    lines.push({
      description: description || "ITEM",
      uom: uomFromWord(qm[2]),
      qty: Number(qm[1]),
      unitPrice: pm ? Number(pm[1]) : 0,
    });
  }

  const matched = lines.length > 0;
  const allPriced = matched && lines.every((l) => l.unitPrice > 0);
  return {
    supplierName: supplierName ?? "UNKNOWN SUPPLIER",
    terms: "C.O.D.",
    deliveryDate: "",
    lines: matched ? lines : [{ description: "UNKNOWN ITEM", uom: "UNIT", qty: 0, unitPrice: 0 }],
    confidence: supplierName && matched && allPriced ? 0.8 : matched ? 0.5 : 0.3,
    notes:
      (matched ? "" : "Could not read any line items. ") +
      (supplierName ? "" : "Supplier not recognised. ") +
      "Parsed offline — please verify before sending.",
  };
}

export async function parsePo(message: string): Promise<ParsedPoDraft> {
  let draft: ParsedPoDraft;
  try {
    draft = (await callClaude(message)) ?? heuristic(message);
  } catch {
    draft = heuristic(message);
  }
  if (draft.deliveryDate && !/^\d{2}\/\d{2}\/\d{4}$/.test(draft.deliveryDate)) {
    draft.deliveryDate = todayDDMMYYYY();
  }
  return draft;
}
