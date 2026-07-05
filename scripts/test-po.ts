// PO flow test (runs in DEMO mode — no env loaded, so the in-memory store is
// used and nothing touches live Supabase). Run: npx tsx scripts/test-po.ts
import { repo } from "../lib/repo";
import { buildPoInvoice } from "../lib/po";
import { invoiceHtml } from "../lib/invoiceHtml";
import type { Order, PurchaseOrder } from "../lib/types";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  console.log(`  ${cond ? "✓" : "✗"} ${label}`);
  cond ? pass++ : fail++;
}

async function main() {
  // 1. Draft a quotation (customer-facing).
  const quoteId = await repo.nextQuoteNo();
  const quote: Order = {
    id: quoteId,
    source: "quotation",
    customerName: "DACO PETSMART SDN BHD",
    customerAddressLines: ["NO 1, JALAN CJ 16/1A, KAWASAN PERINDUSTRIAN CHERAS JAYA"],
    customerTel: "03-9075 1234",
    terms: "Cash",
    date: "16/06/2026",
    lines: [
      { productId: "adhoc-thermal-daco", productName: "80MM X 31MTR CORELESS DACO PETSMART THERMAL ROLL", specLines: [], qty: 1000, uom: "ROLLS", sellUnitPrice: 2 },
    ],
    status: "quote",
    createdAt: new Date().toISOString(),
  };
  await repo.addQuotation(quote);
  check("quotation created", (await repo.listQuotations()).some((q) => q.id === quoteId));

  // 2. Create a PO linked to that quotation (procuring raw materials from a supplier).
  const poId = await repo.nextPoNo();
  console.log("Next PO no:", poId);
  const po: PurchaseOrder = {
    id: poId,
    quotationId: quoteId,
    supplierName: "SWAN COATINGS (M) SDN BHD",
    supplierAddressLines: ["NO 1 JLN SG.KAYU ARA 32/39 SEK.32", "40160 SHAH ALAM SELANGOR"],
    supplierTel: "03 5740 6033",
    yourRef: quoteId,
    terms: "C.O.D.",
    date: "30/06/2026",
    deliveryDate: "30/06/2026",
    lines: [{ description: "FLEXOTON PMS 012U YELLOW FTN 11081", uom: "KGS", qty: 50, unitPrice: 19.55 }],
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  await repo.addPurchaseOrder(po);
  check("PO appears in list", (await repo.listPurchaseOrders()).some((p) => p.id === poId));
  check("PO linked to quotation", (await repo.getPurchaseOrder(poId))?.quotationId === quoteId);

  const inv = buildPoInvoice(po);
  check("PO total = 50*19.55 = 977.5", inv.finalTotal === 977.5);
  const html = invoiceHtml(inv, { docLabel: "PURCHASE ORDER", deliveryDate: po.deliveryDate, hideNotes: true, hideQr: true, forceSignature: true });
  check('renders "PURCHASE ORDER" title', html.includes(">PURCHASE ORDER<"));
  check("renders supplier name", html.includes("SWAN COATINGS"));
  check("renders Delivery Date row, not D/O", html.includes("Delivery Date") && !html.includes("Our D/O No."));
  check("bank notes hidden", !html.includes("Account No:"));
  check("authorised signature forced on", html.includes("Authorised Signature"));

  // 3. Confirm the PO — should spawn the quotation's pending sell-order.
  const result = await repo.confirmPurchaseOrder(poId);
  check("confirm returns an orderId", !!result?.orderId && result.orderId.startsWith("ord-"));
  const pending = await repo.listPendingOrders();
  check("spawned order is now pending", pending.some((o) => o.id === result?.orderId));
  check("spawned order keeps quotation's lines", pending.find((o) => o.id === result?.orderId)?.lines[0].sellUnitPrice === 2);
  const quotesAfter = await repo.listQuotations();
  check("quotation is now marked accepted", quotesAfter.find((q) => q.id === quoteId)?.status === "accepted");
  const poAfter = await repo.getPurchaseOrder(poId);
  check("PO is now confirmed", poAfter?.status === "confirmed");
  check("PO records the linked order id", poAfter?.linkedOrderId === result?.orderId);

  // 4. Standalone PO (no quotation link) — confirming should not spawn anything.
  const poId2 = await repo.nextPoNo();
  await repo.addPurchaseOrder({
    id: poId2, supplierName: "ROUTINE SUPPLIES SDN BHD", supplierAddressLines: [], terms: "C.O.D.",
    date: "01/07/2026", lines: [{ description: "PACKING TAPE", uom: "ROLLS", qty: 10, unitPrice: 3 }],
    status: "draft", createdAt: new Date().toISOString(),
  });
  const result2 = await repo.confirmPurchaseOrder(poId2);
  check("standalone PO confirm returns no orderId", result2?.orderId === undefined);
  check("standalone PO is confirmed", (await repo.getPurchaseOrder(poId2))?.status === "confirmed");

  console.log(`\n${fail === 0 ? "ALL PASS ✅" : `${fail} FAILED ❌`}  (${pass}/${pass + fail})`);
  if (fail) process.exit(1);
}

main();
