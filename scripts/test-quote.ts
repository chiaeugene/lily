// Quote flow test (runs in DEMO mode — no env loaded, so the in-memory store is
// used and nothing touches live Supabase). Run: npx tsx scripts/test-quote.ts
import { repo } from "../lib/repo";
import { buildQuoteInvoice } from "../lib/quote";
import { invoiceHtml } from "../lib/invoiceHtml";
import type { Order } from "../lib/types";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  console.log(`  ${cond ? "✓" : "✗"} ${label}`);
  cond ? pass++ : fail++;
}

async function main() {
  const id = await repo.nextQuoteNo();
  console.log("Next quote no:", id);

  const quote: Order = {
    id,
    source: "quotation",
    customerName: "GOODWILL MARKETING",
    customerAddressLines: ["NO 11 JLN BUNGA KEMBOJA 7D", "TAMAN MUDA 56100 KUALA LUMPUR"],
    customerTel: "016 891 1682",
    terms: "C.O.D.",
    date: "28/06/2026",
    lines: [
      { productId: "nap-cocktail-2ply", productName: "COCKTAIL NAPKIN 2PLY PLAIN 23CM X 23CM", specLines: ["20PKTS X 250'S"], qty: 10, uom: "BOXES", sellUnitPrice: 85 },
      { productId: "th-80x80", productName: "THERMAL PAPER ROLL 80MM X 80MM", specLines: [], qty: 20, uom: "BOXES", sellUnitPrice: 30 },
    ],
    status: "quote",
    createdAt: new Date().toISOString(),
  };

  await repo.addQuotation(quote);
  const list = await repo.listQuotations();
  check("quotation appears in list", list.some((q) => q.id === id));

  const inv = buildQuoteInvoice(quote);
  check("quote total = 10*85 + 20*30 = 1450", inv.finalTotal === 1450);
  const html = invoiceHtml(inv, { docLabel: "QUOTATION" });
  check('renders "QUOTATION" title', html.includes(">QUOTATION<"));
  check("renders customer name", html.includes("GOODWILL MARKETING"));
  check("renders a product line", html.includes("COCKTAIL NAPKIN 2PLY"));
  check('shows "computer generated Quotation"', html.includes("computer generated Quotation"));
  check('shows "Valid Until" row, not D/O', html.includes("Valid Until") && !html.includes("Our D/O No."));

  const newOrderId = await repo.convertQuotationToOrder(id);
  check("convert returns a new order id", !!newOrderId && newOrderId.startsWith("ord-"));
  const pending = await repo.listPendingOrders();
  check("new order is now pending", pending.some((o) => o.id === newOrderId));
  const after = await repo.listQuotations();
  check("quote is now marked accepted", after.find((q) => q.id === id)?.status === "accepted");

  console.log(`\n${fail === 0 ? "ALL PASS ✅" : `${fail} FAILED ❌`}  (${pass}/${pass + fail})`);
  if (fail) process.exit(1);
}

main();
