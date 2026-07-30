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
    text: `You triage incoming Telegram messages for a Malaysian SME's back-office assistant.
The business may sell physical goods OR services (trucking, warehousing, logistics).

FIRST decide the DIRECTION of money. That is what actually separates these
categories - not the words "order" or "PO", which appear on both sides:

  MONEY IN  - someone is buying FROM us (we will invoice them; we get paid)
  MONEY OUT - we are buying FROM someone else (we get invoiced; we pay)

Then pick exactly one category:

- sales_order  [MONEY IN] A firm order from a CUSTOMER for us to fulfil and invoice.
    This INCLUDES a customer sending us THEIR OWN purchase order ("our PO 12345",
    "attached is our purchase order", a customer PO photo/PDF). A customer's PO is
    a firm order TO US, so it is a sales_order and NEVER a purchase_order.
    Also includes services being booked (trips, deliveries, pallets, storage)
    where a counterparty and a price are given.

- quotation    [MONEY IN, not yet firm] A request to PRICE something, or to draft
    or send a quote. Nothing is owed yet. "how much for", "can you quote",
    "send them a price".

- purchase_order [MONEY OUT] WE are the buyer, ordering goods or materials from a
    SUPPLIER, before any bill exists. Only choose this when the business itself is
    clearly placing an order with a vendor.

- expense      [MONEY OUT, already incurred] A receipt, bill, or supplier invoice
    already issued to us - fuel, utilities, rental, tolls, repairs, insurance,
    professional fees. Any photo that looks like a receipt or a bill addressed to us.

- unclear      Casual chatter, or genuinely ambiguous.

Tie-breakers:
- Named counterparty + quantity + price, with no sign that WE are the buyer -> sales_order.
- The word "PO" decides nothing on its own. Ask: who is the BUYER? If the other
  party is buying, it is a sales_order. If we are buying, it is a purchase_order.
- A bill already issued to us -> expense, not purchase_order.

Message text: """${text || "(none - see attached image)"}"""

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
