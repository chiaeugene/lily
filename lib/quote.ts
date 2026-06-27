// Quotation helpers. A quotation is stored as an order row (source="quotation")
// and rendered with the customer-facing company skin (3C) as a "QUOTATION"
// document. Accepting it spawns a normal pending order → the 3-invoice cascade.

import type { Order, Invoice, InvoiceLine } from "./types";
import { round2, roundTo5Sen, ringgitInWords } from "./money";
import { COMPANIES } from "./companies";

// The customer-facing seller issues quotations to the end customer.
export const QUOTE_COMPANY = "3c" as const;

/** Build a printable Invoice object (3C skin) from a stored quotation order. */
export function buildQuoteInvoice(quote: Order): Invoice {
  const c = COMPANIES[QUOTE_COMPANY];
  let subtotal = 0;
  const lines: InvoiceLine[] = quote.lines.map((l, i) => {
    const total = round2(l.qty * l.sellUnitPrice - (l.disc ?? 0));
    subtotal += total;
    return {
      item: i + 1,
      description: l.productName,
      specLines: l.specLines,
      qty: l.qty,
      uom: l.uom,
      unitPrice: l.sellUnitPrice,
      disc: l.disc ?? 0,
      total,
    };
  });
  subtotal = round2(subtotal);
  const finalTotal = c.showRoundingRow ? roundTo5Sen(subtotal) : subtotal;
  const roundingAdj = round2(finalTotal - subtotal);

  return {
    id: quote.id,
    company: QUOTE_COMPANY,
    invoiceNo: quote.id,
    doNo: "",
    yourRef: "",
    toName: quote.customerName,
    toAddressLines: quote.customerAddressLines,
    toTel: quote.customerTel,
    terms: quote.terms,
    date: quote.date,
    lines,
    subtotal,
    roundingAdj,
    finalTotal,
    amountInWords: ringgitInWords(finalTotal),
  };
}
