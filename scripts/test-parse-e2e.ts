// End-to-end parse test: runs the real parseOrder() (heuristic path, no API key)
// against the live Supabase catalog/customers. Run: npx tsx scripts/test-parse-e2e.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(join(here, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
// Ensure heuristic path (don't call the real API in a test).
delete process.env.ANTHROPIC_API_KEY;

const MESSAGES = [
  "118kg thermal 48gsm 225mm to KF Advisor at 8, cod",
  `to Goodwill Marketing
10 boxes cocktail napkin 2ply 23x23 at 85
5 boxes coreless thermal 57x38x12 at 54.50`,
  "68 boxes coreless 57x38x12 to KF Advisor @54.50 cod",
  "20 boxes 80x80 thermal, 15 boxes 5740 to Goodwill",
];

async function main() {
  const { parseOrder } = await import("../lib/parseOrder");
  for (const msg of MESSAGES) {
    const order = await parseOrder(msg, "tester");
    console.log("\n— MESSAGE —\n" + msg);
    console.log(`  customer: ${order.customerName}   terms: ${order.terms}   conf: ${Math.round((order.parseConfidence ?? 0) * 100)}%`);
    for (const l of order.lines) {
      console.log(`  • ${l.qty} ${l.uom}  ${l.productName}  @ RM${l.sellUnitPrice}  [${l.productId}]`);
    }
    if (order.parseNotes) console.log(`  notes: ${order.parseNotes}`);
  }
}

main();
