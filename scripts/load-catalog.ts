// Load the product catalog (lib/catalog.ts) into the live Supabase `products`
// table. Idempotent upsert by id. Run:  npx tsx scripts/load-catalog.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { SEED_PRODUCTS } from "../lib/catalog";

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
    console.error("Upsert failed:", error.message);
    process.exit(1);
  }

  const { data, count } = await db
    .from("products")
    .select("id,name,uom", { count: "exact" })
    .order("id");
  console.log(`products table now has ${count} rows:`);
  for (const r of data ?? []) console.log(`  ${r.id.padEnd(20)} ${r.uom.padEnd(7)} ${r.name}`);
}

main();
