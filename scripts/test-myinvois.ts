// Sanity tests for the MyInvois integration surface:
//  1. invoiceHtml renders NO LHDN mark on an unsubmitted invoice (no fake badges)
//  2. submitted / valid states render their genuine marks
//  3. isMyinvoisConfigured() is false without env vars
// Run: npx tsx scripts/test-myinvois.ts

import { invoiceHtml } from "../lib/invoiceHtml";
import { isMyinvoisConfigured } from "../lib/myinvois";
import type { Invoice } from "../lib/types";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `: ${detail}` : ""}`);
  if (!ok) failures++;
}

const base: Invoice = {
  id: "t-3c",
  company: "3c",
  invoiceNo: "INV-2608/001",
  doNo: "DO-2608/001",
  yourRef: "",
  toName: "KF ADVISOR",
  toAddressLines: ["A-07-11 MENARA PRIMA"],
  terms: "C.O.D.",
  date: "06/08/2026",
  lines: [
    { item: 1, description: "THERMAL PAPER", specLines: [], qty: 10, uom: "KGS", unitPrice: 8, disc: 0, total: 80 },
  ],
  subtotal: 80,
  roundingAdj: 0,
  finalTotal: 80,
  amountInWords: "RINGGIT MALAYSIA EIGHTY ONLY",
};

// 1. unsubmitted -> no LHDN text at all
const plain = invoiceHtml({ ...base });
check("unsubmitted invoice carries no LHDN mark", !plain.includes("LHDN"));

// 2a. submitted -> mark + uid
const submitted = invoiceHtml({ ...base, myinvoisStatus: "submitted", myinvoisUid: "SUB-UID-123" });
check("submitted invoice shows 'LHDN e-Invoice Submitted'", submitted.includes("LHDN e-Invoice Submitted"));
check("submitted invoice shows its submission uid", submitted.includes("SUB-UID-123"));

// 2b. valid -> VALIDATED + long id
const valid = invoiceHtml({ ...base, myinvoisStatus: "valid", myinvoisLongId: "LONG-ID-9988" });
check("validated invoice shows 'LHDN e-Invoice VALIDATED'", valid.includes("LHDN e-Invoice VALIDATED"));
check("validated invoice shows its long id", valid.includes("LONG-ID-9988"));

// 3. not configured without env
check("isMyinvoisConfigured() is false without env vars", !isMyinvoisConfigured());

if (failures) {
  console.log(`\n${failures} FAILURE(S) ❌`);
  process.exit(1);
}
console.log("\nALL PASS ✅");
