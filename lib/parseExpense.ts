// Extracts a structured expense draft from a Telegram message and/or an
// attached receipt/bill photo. Falls back to a low-confidence heuristic
// when there's no ANTHROPIC_API_KEY — never throws, always returns a draft
// so nothing gets silently dropped (same philosophy as lib/parseOrder.ts).

import { EXPENSE_CATEGORIES } from "./types";

export interface ExpenseDraft {
  vendorName: string;
  description: string;
  category: string;
  amount: number;
  date: string; // dd/MM/yyyy
  confidence: number;
  notes?: string;
}

const SYSTEM = `You extract a business expense from a Telegram message and/or a photo of a receipt/bill/invoice for a
Malaysian paper/machinery trading business. Return ONLY JSON of shape:
{"vendorName": string, "description": string, "category": string, "amount": number, "date": string, "confidence": number (0..1), "notes": string}
Rules:
- category MUST be exactly one of: ${EXPENSE_CATEGORIES.join(", ")}
- date format dd/MM/yyyy. If no date is visible/given, use today's date.
- amount is the total paid, in Ringgit (numeric, no "RM" prefix).
- description is a short one-line summary (e.g. "Diesel for delivery van", "Electricity bill - July").
- If reading a receipt image, vendorName is the shop/company name printed on it.
- confidence: 1.0 if everything is clear (esp. from a legible receipt), lower if guessing; explain gaps in notes.`;

function todayDDMMYYYY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

async function callClaude(text: string, image?: { base64: string; mime: string }): Promise<ExpenseDraft | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.CLAUDE_PARSER_MODEL || "claude-haiku-4-5-20251001";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: image.mime, data: image.base64 } });
  content.push({ type: "text", text: `Message: ${text || "(none — see attached image)"}` });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 512, system: SYSTEM, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const raw = data.content.find((c) => c.type === "text")?.text ?? "";
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json) as ExpenseDraft;
  if (!EXPENSE_CATEGORIES.includes(parsed.category as (typeof EXPENSE_CATEGORIES)[number])) {
    parsed.category = "Others";
  }
  return parsed;
}

function heuristicFallback(text: string): ExpenseDraft {
  const amountMatch = text.match(/(?:rm|@|price[:\s]*)\s*(\d+(?:\.\d+)?)/i) || text.match(/(\d+(?:\.\d+)?)/);
  return {
    vendorName: "UNKNOWN VENDOR",
    description: text.slice(0, 80) || "Expense",
    category: "Others",
    amount: amountMatch ? Number(amountMatch[1]) : 0,
    date: todayDDMMYYYY(),
    confidence: 0.3,
    notes: "No AI parser configured — please fill in the details on the dashboard.",
  };
}

export async function parseExpense(text: string, image?: { base64: string; mime: string }): Promise<ExpenseDraft> {
  try {
    const draft = await callClaude(text, image);
    if (draft) return draft;
  } catch (e) {
    console.error("[parseExpense] Claude call failed", String((e as Error)?.message ?? e));
  }
  return heuristicFallback(text);
}
