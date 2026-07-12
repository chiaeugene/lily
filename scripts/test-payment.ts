// Payment tracking regression test (DEMO mode). Run: npx tsx scripts/test-payment.ts
import { repo } from "../lib/repo";
import { store } from "../lib/store";
import { dueDate, paymentState, agingBucket } from "../lib/payment";
import type { Order } from "../lib/types";

let pass = 0, fail = 0;
function check(label: string, cond: boolean) {
  console.log(`  ${cond ? "✓" : "✗"} ${label}`);
  cond ? pass++ : fail++;
}

async function main() {
  // 1. C.O.D. transaction (termsDays 0) issued today — should be overdue "today" if unpaid past due, but
  //    since due date == issue date, "today" counts as due (0 days overdue = not yet overdue).
  const codOrder: Order = {
    id: "ord-pay-cod", source: "manual", customerName: "COD CUSTOMER",
    customerAddressLines: [], terms: "C.O.D.", date: "12/07/2026",
    lines: [{ productId: "adhoc-x", productName: "X", specLines: [], qty: 1, uom: "BOXES", sellUnitPrice: 100 }],
    status: "pending", createdAt: new Date().toISOString(),
  };
  store.orders.unshift(codOrder);
  const codTx = await repo.verifyOrder(codOrder.id, "admin", { termsDays: 0 });
  check("COD transaction has termsDays 0", codTx?.termsDays === 0);
  check("COD transaction starts unpaid", codTx?.paidStatus === "unpaid");
  check("COD due date == issue date", dueDate(codTx!)?.getTime() === new Date(2026, 6, 12).getTime());

  // 2. 30-day terms, issued far in the past relative to "now" -> should be overdue and in the 31-60 bucket.
  const netOrder: Order = {
    id: "ord-pay-net30", source: "manual", customerName: "NET30 CUSTOMER",
    customerAddressLines: [], terms: "30 DAYS", date: "01/01/2026", // issued Jan 1, due Jan 31 — long overdue vs "now"
    lines: [{ productId: "adhoc-y", productName: "Y", specLines: [], qty: 1, uom: "BOXES", sellUnitPrice: 500 }],
    status: "pending", createdAt: new Date().toISOString(),
  };
  store.orders.unshift(netOrder);
  const netTx = await repo.verifyOrder(netOrder.id, "admin", { termsDays: 30 });
  check("NET30 transaction has termsDays 30", netTx?.termsDays === 30);
  check("NET30 is overdue (unpaid, past due)", paymentState(netTx!) === "overdue");
  check("NET30 aging bucket is not 'Not due'", agingBucket(netTx!) !== "Not due");

  // 3. Mark paid — status flips, no longer overdue.
  await repo.markTransactionPaid(netTx!.id, true);
  const afterPaid = store.transactions.find((t) => t.id === netTx!.id);
  check("marked paid persists paidStatus", afterPaid?.paidStatus === "paid");
  check("paid transaction has paidAt set", !!afterPaid?.paidAt);
  check("paid transaction payment state is 'paid'", paymentState(afterPaid!) === "paid");

  // 4. Unmark paid — toggles back.
  await repo.markTransactionPaid(netTx!.id, false);
  const afterUnpaid = store.transactions.find((t) => t.id === netTx!.id);
  check("unmarked paid reverts to unpaid", afterUnpaid?.paidStatus === "unpaid");

  console.log(`\n${fail === 0 ? "ALL PASS ✅" : `${fail} FAILED ❌`}  (${pass}/${pass + fail})`);
  if (fail) process.exit(1);
}

main();
