// Purchase order helpers. A PO is Tien Ngai buying raw materials from an
// external supplier — rendered under the Tien Ngai letterhead as a
// "PURCHASE ORDER" document using the same printable layout as invoices.

import type { PurchaseOrder, Invoice, InvoiceLine } from "./types";
import { round2, ringgitInWords } from "./money";

export const PO_COMPANY = "tien_ngai" as const;

/** Build a printable Invoice-shaped object (Tien Ngai skin) from a stored PO. */
export function buildPoInvoice(po: PurchaseOrder): Invoice {
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
    company: PO_COMPANY,
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
