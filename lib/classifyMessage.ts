// Classifies an incoming Telegram message (text and/or an attached photo)
// into what kind of business document it represents. Explicit prefixes
// ("quote:", "po:") still short-circuit this — this is for the common case
// where someone just sends a message or a receipt/document without one,
// since in practice things "jump" (a customer sends their own PO document,
// a supplier bill arrives as a photo, etc.) and forcing a rigid prefix on
// every message doesn't match how the business actually operates.

export type DocType = "quotation" | "purchase_order" | "sales_order" | "expense" | "unclear";

const VALID: DocType[] = ["quotation", "purchase_order", "sales_order", "expense", "unclear"];

export async function classifyMessage(
  text: string,
  image?: { base64: string; mime: string },
): Promise<DocType> {
  const key = process.env.ANTHROPIC_API_KEY;
  // No AI available — fall back to the old default (treat as a sales order),
  // unless it's clearly just a photo with no text, which is far more likely
  // to be a receipt than a firm customer order.
  if (!key) return image && !text.trim() ? "expense" : "sales_order";

  const model = process.env.CLAUDE_PARSER_MODEL || "claude-haiku-4-5-20251001";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];
  if (image) {
    content.push({ type: "image", source: { type: "base64", media_type: image.mime, data: image.base64 } });
  }
  content.push({
    type: "text",
    text: `You triage incoming Telegram messages for a Malaysian paper/machinery trading business's order channel.
Classify this message (and attached image, if any) into exactly one category:

- quotation: asking to draft a price quote for a customer — not a firm order yet
- purchase_order: the business buying raw materials/goods FROM a supplier (it is the buyer)
- sales_order: a firm customer order to fulfill and invoice now (product, qty, price for a sale)
- expense: a receipt, bill, utility/rental/professional-fee invoice, or any business expense document — money going OUT that is not raw-material procurement for resale. Also use this for any photo that looks like a receipt or vendor invoice.
- unclear: casual chatter, or genuinely ambiguous

Message text: """${text || "(none — see attached image)"}"""

Respond with ONLY the single category word, nothing else.`,
  });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 12, messages: [{ role: "user", content }] }),
    });
    if (!res.ok) return "sales_order";
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    const word = (data.content.find((c) => c.type === "text")?.text ?? "").trim().toLowerCase();
    return (VALID as string[]).includes(word) ? (word as DocType) : "sales_order";
  } catch {
    return "sales_order";
  }
}
