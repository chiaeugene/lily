// Load the product catalog (lib/catalog.ts) into the live Supabase `products`
// table. Idempotent upsert by id. Run:  npx tsx scripts/load-catalog.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { SEED_PRODUCTS, SEED_MARGIN_RULES } from "../lib/catalog";

// Load .env.local manually (tsx doesn't auto-read it).
const here = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(join(here, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const rows = SEED_PRODUCTS.map((p) => ({
    id: p.id,
    name: p.name,
    spec_lines: p.specLines,
    uom: p.uom,
  }));

  const { error } = await db.from("products").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("Products upsert failed:", error.message);
    process.exit(1);
  }

  // Margin rules — upsert by (product_id, tier). FK requires the product to exist,
  // which it now does after the products upsert above.
  const ruleRows = SEED_MARGIN_RULES.map((r) => ({
    product_id: r.productId,
    tier: r.tier,
    type: r.type,
    value: r.value,
  }));
  const { error: mErr } = await db.from("margin_rules").upsert(ruleRows, { onConflict: "product_id,tier" });
  if (mErr) {
    console.error("Margin rules upsert failed:", mErr.message);
    process.exit(1);
  }

  const { data, count } = await db
    .from("products")
    .select("id,name,uom", { count: "exact" })
    .order("id");
  const { count: ruleCount } = await db
    .from("margin_rules")
    .select("*", { count: "exact", head: true });
  console.log(`products table now has ${count} rows, margin_rules has ${ruleCount}:`);
  for (const r of data ?? []) console.log(`  ${r.id.padEnd(20)} ${r.uom.padEnd(7)} ${r.name}`);
}

main();
