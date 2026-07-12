// yourRef + invoiceNoOverrides + auto-learn regression test (DEMO mode).
// Run: npx tsx scripts/test-verify-overrides.ts
import { repo } from "../lib/repo";
import { store } from "../lib/store";
import type { Order } from "../lib/types";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  console.log(`  ${cond ? "✓" : "✗"} ${label}`);
  cond ? pass++ : fail++;
}

async function main() {
  const before3c = store.counters["3c"];
  const beforeTn = store.counters.tien_ngai;

  const order: Order = {
    id: "ord-override-test",
    source: "manual",
    customerName: "BRAND NEW CUSTOMER SDN BHD",
    customerAddressLines: ["1 JALAN TEST"],
    customerTel: "012 000 0000",
    terms: "C.O.D.",
    date: "12/07/2026",
    lines: [
      { productId: "adhoc-mystery-widget", productName: "MYSTERY WIDGET", specLines: [], qty: 5, uom: "BOXES", sellUnitPrice: 20 },
    ],
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  store.orders.unshift(order);

  const tx = await repo.verifyOrder(order.id, "admin", {
    companies: ["tien_ngai", "3c"],
    yourRef: "PO-TEST-001",
    invoiceNoOverrides: { "3c": "MANUAL-3C-999" },
  });

  check("transaction generated", !!tx);
  const tn = tx!.invoices.find((i) => i.company === "tien_ngai")!;
  const c3 = tx!.invoices.find((i) => i.company === "3c")!;
  check("yourRef applied to tien_ngai invoice", tn.yourRef === "PO-TEST-001");
  check("yourRef applied to 3c invoice", c3.yourRef === "PO-TEST-001");
  check("3c invoice number overridden", c3.invoiceNo === "MANUAL-3C-999");
  check("3c do_no derived from override safely", c3.doNo === "DO-MANUAL-3C-999");
  check("tien_ngai invoice number still auto-generated", tn.invoiceNo !== "" && tn.invoiceNo !== "MANUAL-3C-999");
  check("3c counter NOT incremented (override skips it)", store.counters["3c"] === before3c);
  check("tien_ngai counter WAS incremented (no override)", store.counters.tien_ngai === beforeTn + 1);

  // auto-learn: brand new customer + unmatched product should now be in the catalog
  const customers = await repo.listCustomers();
  const products = await repo.listProducts();
  check("new customer auto-learned into catalog", customers.some((c) => c.name === "BRAND NEW CUSTOMER SDN BHD"));
  check("new product auto-learned into catalog", products.some((p) => p.name === "MYSTERY WIDGET"));

  console.log(`\n${fail === 0 ? "ALL PASS ✅" : `${fail} FAILED ❌`}  (${pass}/${pass + fail})`);
  if (fail) process.exit(1);
}

main();
