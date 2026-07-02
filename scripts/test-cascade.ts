// Quick sanity check of the cascade engine. Run: npm run test:cascade
import { buildCascade } from "../lib/cascade";
import type { Order, MarginRule, CompanyKey } from "../lib/types";

const order: Order = {
  id: "ord-test",
  source: "manual",
  customerName: "KF ADVISOR",
  customerAddressLines: ["A-07-11 MENARA PRIMA"],
  customerTel: "012 621 9399",
  terms: "C.O.D.",
  date: "10/06/2026",
  lines: [
    {
      productId: "tp-48-225",
      productName: "THERMAL PAPER 48GSM 225MM",
      specLines: ["59.5KG-1ROLL", "58.5KG-1ROLL"],
      qty: 118,
      uom: "KGS",
      sellUnitPrice: 8,
    },
  ],
  status: "pending",
  createdAt: new Date().toISOString(),
};

// Chain: Tien Ngai (origin) -> Prim -> 3C (sells to customer). Margins taken by 3C and Prim.
const rules: MarginRule[] = [
  { productId: "tp-48-225", layer: 1, type: "rm_per_unit", value: 0.4 },
  { productId: "tp-48-225", layer: 2, type: "rm_per_unit", value: 0.4 },
];

let counters: Record<CompanyKey, number> = { tien_ngai: 187880, "3c": 7, prim: 4 };
const tx = buildCascade(order, {
  transactionId: "TX-TEST",
  orderId: order.id,
  marginRules: rules,
  allocateInvoiceNo: (c) => {
    counters[c] += 1;
    return `${c}-${counters[c]}`;
  },
});

let pass = true;
function check(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) pass = false;
  console.log(`${ok ? "✓" : "✗"} ${label}: got ${got}${ok ? "" : ` (want ${want})`}`);
}

for (const inv of tx.invoices) {
  console.log(
    `\n${inv.company.toUpperCase()}  ${inv.invoiceNo}  ${inv.doNo}  -> bills ${inv.toName}`,
  );
  console.log(`   unit RM${inv.lines[0].unitPrice}  total RM${inv.finalTotal}  words: ${inv.amountInWords}`);
}

const prim = tx.invoices.find((i) => i.company === "prim")!;
const c3 = tx.invoices.find((i) => i.company === "3c")!;
const tn = tx.invoices.find((i) => i.company === "tien_ngai")!;

console.log("\n── assertions ──");
check("3C (customer) unit price", c3.lines[0].unitPrice, 8);
check("Prim->3C unit price", prim.lines[0].unitPrice, 7.6);
check("TienNgai->Prim unit price", tn.lines[0].unitPrice, 7.2);
check("3C total (to customer)", c3.finalTotal, 944);
check("Prim total", prim.finalTotal, 896.8);
check("Tien Ngai total (origin)", tn.finalTotal, 849.6);
check("3C bills the customer", c3.toName, "KF ADVISOR");
check("Prim bills 3C", prim.toName, "3C INDUSTRIES SDN BHD");
check("Tien Ngai bills Prim", tn.toName, "PRIM PAPER TRADING SDN BHD");
check("Group margin captured", tx.marginCaptured, 94.4);
check("3C amount in words", c3.amountInWords, "RINGGIT MALAYSIA NINE HUNDRED FORTY FOUR ONLY");

console.log(`\n${pass ? "ALL PASS ✅" : "FAILURES ❌"}`);
process.exit(pass ? 0 : 1);
