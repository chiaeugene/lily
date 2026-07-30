// Quotation helpers. A quotation is stored as an order row (source="quotation")
// and rendered as a "QUOTATION" document under the ISSUING company's letterhead.
// Accepting it spawns a normal pending order.
//
// The issuing company is passed in rather than hardcoded: it used to be a
// constant "3c", which printed every tenant's quotation as 3C Industries.
// See lib/tenantCompanies.ts getIssuingCompany("quote").

import type { Order, Invoice, InvoiceLine, Company } from "./types";
import { round2, roundTo5Sen, ringgitInWords } from "./money";

/** Build a printable Invoice object from a stored quotation order. */
export function buildQuoteInvoice(quote: Order, c: Company): Invoice {
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
    company: c.key,
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
