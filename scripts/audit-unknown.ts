// Read-only audit of "Unknown"/junk pending orders and transactions against
// the LIVE Supabase database. Does not modify anything. Run:
//   npx tsx scripts/audit-unknown.ts
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

const UNKNOWN_RE = /^(unknown( customer)?|not provided|n\/?a)$/i;

async function main() {
  console.log("=== SCHEMA CHECK ===\n");
  const { data: sample, error: schemaErr } = await db.from("transactions").select("*").limit(1);
  console.log("transactions columns present:", sample?.[0] ? Object.keys(sample[0]).join(", ") : "(no rows)", schemaErr?.message ?? "");
  const { error: poErr } = await db.from("purchase_orders").select("id").limit(1);
  console.log("purchase_orders table:", poErr ? `MISSING (${poErr.message})` : "exists");
  console.log("");

  console.log("=== ALL PENDING ORDERS (raw) ===\n");
  const { data: allOrders } = await db.from("orders").select("id,customer_name,lines,parse_confidence").eq("status", "pending");
  console.log(`total pending: ${allOrders?.length}\n`);
  for (const o of allOrders ?? []) {
    const total = (o.lines ?? []).reduce((s: number, l: { qty: number; sellUnitPrice: number }) => s + l.qty * l.sellUnitPrice, 0);
    console.log(`${JSON.stringify(o.customer_name)}  RM${total}  conf=${o.parse_confidence}  ${o.id}`);
  }

  console.log("\n=== PENDING ORDERS with unrecognized customer ===\n");
  const { data: orders } = await db.from("orders").select("*").eq("status", "pending");
  let junkPending = 0, realPending = 0;
  for (const o of orders ?? []) {
    const isUnknown = UNKNOWN_RE.test((o.customer_name ?? "").trim());
    if (!isUnknown) continue;
    const total = (o.lines ?? []).reduce((s: number, l: { qty: number; sellUnitPrice: number }) => s + l.qty * l.sellUnitPrice, 0);
    const looksJunk = total === 0;
    if (looksJunk) junkPending++; else realPending++;
    console.log(
      `${looksJunk ? "[JUNK RM0]  " : "[HAS VALUE] "}${o.id}  "${o.customer_name}"  RM${total}  conf=${o.parse_confidence ?? "?"}  raw="${(o.raw_message ?? "").slice(0, 60)}"`,
    );
  }
  console.log(`\n-> ${junkPending} zero-value junk pending, ${realPending} unknown-customer pending WITH real line value\n`);

  console.log("=== ALL TRANSACTIONS (raw, most recent 40) ===\n");
  const { data: allTx, error: txErr, count: txCount } = await db.from("transactions").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(40);
  if (txErr) console.log("ERROR:", txErr.message);
  console.log(`count=${txCount}\n`);
  for (const t of allTx ?? []) {
    console.log(`${JSON.stringify(t.customer_name)}  RM${t.grand_total_sell}  ${t.date}  status=${t.status ?? "(column missing, defaults active)"}  ${t.id}`);
  }

  console.log("\n=== TRANSACTIONS with unrecognized customer ===\n");
  const { data: txs } = await db.from("transactions").select("*");
  let junkTx = 0, realTx = 0;
  for (const t of txs ?? []) {
    const isUnknown = UNKNOWN_RE.test((t.customer_name ?? "").trim());
    if (!isUnknown) continue;
    const looksJunk = Number(t.grand_total_sell) === 0;
    if (looksJunk) junkTx++; else realTx++;
    console.log(
      `${looksJunk ? "[JUNK RM0]  " : "[HAS VALUE] "}${t.id}  "${t.customer_name}"  RM${t.grand_total_sell}  margin=RM${t.margin_captured}  date=${t.date}`,
    );
  }
  console.log(`\n-> ${junkTx} zero-value junk transactions, ${realTx} unknown-customer transactions WITH real RM value (already invoiced)\n`);
}

main();

