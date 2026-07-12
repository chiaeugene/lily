// One-off cleanup against the LIVE Supabase database, per user confirmation:
//   1. Reject the duplicate "Unknown" pending order (keep one JRT order + the RM225 one).
//   2. Void the 3 already-invoiced "Unknown" transactions (only run after migration 001 is applied).
// Run: npx tsx scripts/fix-unknown-cleanup.ts [--void]
//   (no flag = step 1 only; --void also does step 2, once migration 001 is confirmed applied)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(join(here, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DUPLICATE_ORDER_ID = "ord-mrd63eak"; // one of the two identical RM12,725 JRT drafts — keep ord-mrd630ja
const UNKNOWN_TX_IDS = ["TX-MRD67WEP", "TX-MRD645EN", "TX-MRCB2X8C"];

async function main() {
  // Step 1: reject the duplicate pending order.
  const { data: before } = await db.from("orders").select("id,customer_name,status").eq("id", DUPLICATE_ORDER_ID).single();
  if (!before) {
    console.log(`Order ${DUPLICATE_ORDER_ID} not found — already handled?`);
  } else if (before.status !== "pending") {
    console.log(`Order ${DUPLICATE_ORDER_ID} is already status=${before.status}, skipping.`);
  } else {
    const { error } = await db.from("orders").update({ status: "rejected" }).eq("id", DUPLICATE_ORDER_ID);
    if (error) console.error("Reject failed:", error.message);
    else console.log(`✓ Rejected duplicate pending order ${DUPLICATE_ORDER_ID} (${before.customer_name})`);
  }

  // Step 2: void the 3 unknown transactions — only if --void passed AND status column exists.
  if (!process.argv.includes("--void")) {
    console.log("\n(skipping void step — rerun with --void once migration 001 is confirmed applied)");
    return;
  }

  const { error: probeErr } = await db.from("transactions").select("status").limit(1);
  if (probeErr) {
    console.error("\nCannot void yet — migration 001 hasn't been applied:", probeErr.message);
    return;
  }

  for (const id of UNKNOWN_TX_IDS) {
    const { data: tx } = await db.from("transactions").select("id,customer_name,grand_total_sell,status").eq("id", id).single();
    if (!tx) { console.log(`${id}: not found`); continue; }
    if (tx.status === "void") { console.log(`${id}: already void`); continue; }
    const { error } = await db
      .from("transactions")
      .update({ status: "void", void_reason: "Unknown customer — never identified, voided per owner review", voided_at: new Date().toISOString() })
      .eq("id", id);
    if (error) console.error(`${id}: FAILED — ${error.message}`);
    else console.log(`✓ Voided ${id}  "${tx.customer_name}"  RM${tx.grand_total_sell}`);
  }
}

main();
