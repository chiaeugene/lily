// Purchase order helpers. A PO is the business buying from an external
// supplier — rendered under the BUYING company's letterhead as a
// "PURCHASE ORDER" document, using the same printable layout as invoices.
//
// The buying company is passed in rather than hardcoded: it used to be a
// constant "tien_ngai", which printed every tenant's PO under Tien Ngai's
// letterhead. See lib/tenantCompanies.ts getIssuingCompany("po").

import type { PurchaseOrder, Invoice, InvoiceLine, Company } from "./types";
import { round2, ringgitInWords } from "./money";

/** Build a printable Invoice-shaped object from a stored PO. */
export function buildPoInvoice(po: PurchaseOrder, c: Company): Invoice {
  let subtotal = 0;
  const lines: InvoiceLine[] = po.lines.map((l, i) => {
    const total = round2(l.qty * l.unitPrice - (l.disc ?? 0));
    subtotal += total;
    return {
      item: i + 1,
      description: l.description,
      specLines: [],
      qty: l.qty,
      uom: l.uom,
      unitPrice: l.unitPrice,
      disc: l.disc ?? 0,
      total,
    };
  });
  subtotal = round2(subtotal);

  return {
    id: po.id,
    company: c.key,
    invoiceNo: po.id,
    doNo: "",
    yourRef: po.yourRef ?? "",
    toName: po.supplierName,
    toAddressLines: po.supplierAddressLines,
    toTel: po.supplierTel,
    toFax: po.supplierFax,
    terms: po.terms,
    date: po.date,
    lines,
    subtotal,
    roundingAdj: 0,
    finalTotal: subtotal,
    amountInWords: ringgitInWords(subtotal),
  };
}
