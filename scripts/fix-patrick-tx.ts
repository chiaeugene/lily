// Fix the Patrick transaction that was generated with wrong prices (two RM 880
// invoices due to reversed tick order and missing TNM margin rule).
// Finds all transactions for Patrick, shows current state, then recalculates
// and patches invoices using the corrected layer-based cascade logic.

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

function round2(n: number) { return Math.round(n * 100) / 100; }
function roundTo5Sen(n: number) { return Math.round(n / 0.05) * 0.05; }

// Layer-based margin: depth 1 = customer-facing, 2 = inner
function deriveUpstreamPrice(selling: number, rule: { type: string; value: number } | undefined): number {
  if (!rule) return selling;
  if (rule.type === "rm_per_unit") return Math.max(0, round2(selling - rule.value));
  return round2(selling / (1 + rule.value / 100));
}

// Number to words (ringgit) — minimal version for the fix
function ringgitInWords(n: number): string {
  return `RM ${n.toFixed(2)} ONLY`;
}

async function main() {
  // 1. Find Patrick transaction(s)
  const { data: txRows } = await db
    .from("transactions")
    .select("*")
    .ilike("customer_name", "%patrick%")
    .order("created_at", { ascending: false });

  if (!txRows?.length) {
    console.log("No Patrick transactions found.");
    return;
  }

  console.log(`Found ${txRows.length} Patrick transaction(s):\n`);

  for (const tx of txRows) {
    console.log(`TX: ${tx.id}  customer: ${tx.customer_name}  date: ${tx.date}`);

    // 2. Load invoices for this transaction
    const { data: invRows } = await db
      .from("invoices")
      .select("*")
      .eq("transaction_id", tx.id)
      .order("company");

    if (!invRows?.length) { console.log("  No invoices found.\n"); continue; }

    console.log(`  Invoices (${invRows.length}):`);
    for (const inv of invRows) {
      console.log(`    [${inv.company}] ${inv.invoice_no}  total: RM ${inv.final_total}`);
      for (const l of (inv.lines ?? [])) {
        console.log(`      ${l.qty} ${l.uom} ${l.description} @ RM${l.unitPrice}  = RM${l.total}`);
      }
    }

    // 3. Load the original order
    const { data: orderRow } = await db
      .from("orders")
      .select("*")
      .eq("id", tx.order_id)
      .single();

    if (!orderRow) { console.log("  Original order not found.\n"); continue; }

    const lines: { productId: string; qty: number; sellUnitPrice: number; disc?: number }[] =
      (orderRow.lines ?? []);

    // 4. Load margin rules
    const { data: marginRows } = await db.from("margin_rules").select("*");
    const marginRules = (marginRows ?? []).map((r: { product_id: string; tier: string; type: string; value: number }) => ({
      productId: r.product_id,
      layer: isNaN(Number(r.tier)) ? ({ "3c": 1, prim: 2, tien_ngai: 3 } as Record<string, number>)[r.tier] ?? 1 : Number(r.tier),
      type: r.type as "rm_per_unit" | "percent",
      value: Number(r.value),
    }));

    // 5. Determine which companies this transaction has invoices for (in natural chain order)
    const CHAIN = ["tien_ngai", "prim", "3c"] as const;
    const presentCompanies = CHAIN.filter(c => invRows.some(inv => inv.company === c));
    console.log(`\n  Companies in this TX: ${presentCompanies.join(" → ")}`);

    // 6. Recalculate prices using layer-based cascade
    const COMPANIES: Record<string, { name: string; addressLines: string[]; tel?: string; invoicePrefix: string; showRoundingRow: boolean }> = {
      tien_ngai: { name: "TIEN NGAI MACHINERY SDN BHD", addressLines: ["NO.19, JALAN PP 16/5, PERDANA INDUSTRY PARK", "TAMAN PUTRA PERDANA 47130 PUCHONG SELANGOR"], tel: "03 8322 3188 / 014 334 9588", invoicePrefix: "INV-", showRoundingRow: false },
      prim:      { name: "PRIM PAPER TRADING SDN BHD",  addressLines: ["NO 4554 TAMAN RAWANG 48000 RAWANG SELANGOR"], tel: "014 334 9588", invoicePrefix: "I-", showRoundingRow: false },
      "3c":      { name: "3C INDUSTRIES SDN BHD",       addressLines: ["NO.19, JALAN PP 16/5, PERDANA INDUSTRY PARK", "TAMAN PUTRA PERDANA 47130 PUCHONG SELANGOR"], tel: "03-8322 3188 / 014 334 9588", invoicePrefix: "INV-", showRoundingRow: true },
    };

    const lastSelected = presentCompanies[presentCompanies.length - 1];
    const priceByCompany: Record<string, Map<string, number>> = { tien_ngai: new Map(), prim: new Map(), "3c": new Map() };

    for (const ol of lines) {
      priceByCompany[lastSelected].set(ol.productId, ol.sellUnitPrice);
      for (let i = presentCompanies.length - 1; i > 0; i--) {
        const buyer  = presentCompanies[i];
        const seller = presentCompanies[i - 1];
        const buyerPrice = priceByCompany[buyer].get(ol.productId)!;
        const depth = presentCompanies.length - i; // 1 = customer-facing
        const rule = marginRules.find((r: { productId: string; layer: number }) => r.productId === ol.productId && r.layer === depth)
                  ?? marginRules.find((r: { productId: string; layer: number }) => r.productId === "*"   && r.layer === depth);
        priceByCompany[seller].set(ol.productId, deriveUpstreamPrice(buyerPrice, rule));
      }
    }

    // Bill-to chain (last selected bills customer, others bill next selected)
    function billTo(company: string) {
      const idx = presentCompanies.indexOf(company as typeof presentCompanies[number]);
      const next = presentCompanies[idx + 1];
      if (!next) return { name: orderRow.customer_name, addr: orderRow.customer_address_lines ?? [], tel: orderRow.customer_tel };
      const c = COMPANIES[next];
      return { name: c.name, addr: c.addressLines, tel: c.tel };
    }

    console.log("\n  Recalculated prices:");
    let anyChange = false;

    for (const inv of invRows) {
      const company = inv.company as string;
      const priceMap = priceByCompany[company];
      const c = COMPANIES[company];
      let subtotal = 0;

      const newLines = (inv.lines as { item: number; description: string; specLines?: string[]; qty: number; uom: string; unitPrice: number; disc?: number; total: number }[]).map((l) => {
        const productId = lines.find(ol => ol.qty === l.qty)?.productId ?? "";
        const unitPrice = priceMap.get(productId) ?? l.unitPrice; // fall back if product not found
        const disc = l.disc ?? 0;
        const total = round2(l.qty * unitPrice - disc);
        subtotal += total;
        return { ...l, unitPrice, total };
      });

      const roundedSubtotal = round2(subtotal);
      let finalTotal = roundedSubtotal;
      let roundingAdj = 0;
      if (c.showRoundingRow) {
        finalTotal = roundTo5Sen(roundedSubtotal);
        roundingAdj = round2(finalTotal - roundedSubtotal);
      }

      const oldTotal = Number(inv.final_total);
      const toObj = billTo(company);
      console.log(`    [${company}] ${inv.invoice_no}: RM ${oldTotal} → RM ${finalTotal}  bills: ${toObj.name}`);

      if (Math.abs(oldTotal - finalTotal) > 0.001) anyChange = true;

      // 7. Patch the invoice row
      const { error } = await db.from("invoices").update({
        lines: newLines,
        subtotal: roundedSubtotal,
        rounding_adj: roundingAdj,
        final_total: finalTotal,
        amount_in_words: ringgitInWords(finalTotal),
        to_name: toObj.name,
        to_address_lines: toObj.addr,
        to_tel: toObj.tel ?? null,
      }).eq("id", inv.id);

      if (error) console.error(`    ERROR patching ${inv.id}:`, error.message);
      else console.log(`    ✓ patched`);
    }

    // 8. Patch the transaction totals
    const sellInv = invRows.find(i => i.company === lastSelected);
    const originInv = invRows.find(i => i.company === presentCompanies[0]);
    if (sellInv && originInv) {
      const newSell  = Number(priceByCompany[lastSelected].values().next().value) * (lines[0]?.qty ?? 1);
      const newOrigin = Number(priceByCompany[presentCompanies[0]].values().next().value) * (lines[0]?.qty ?? 1);
      // Use the actual updated invoice totals instead
      const { data: updatedInvs } = await db.from("invoices").select("company,final_total").eq("transaction_id", tx.id);
      const sellTotal   = Number(updatedInvs?.find(i => i.company === lastSelected)?.final_total ?? 0);
      const originTotal = Number(updatedInvs?.find(i => i.company === presentCompanies[0])?.final_total ?? 0);
      await db.from("transactions").update({
        grand_total_sell: sellTotal,
        margin_captured: round2(sellTotal - originTotal),
      }).eq("id", tx.id);
      console.log(`\n  TX totals: sell RM ${sellTotal}  margin RM ${round2(sellTotal - originTotal)}`);
    }

    console.log(anyChange ? "\n  ✅ Transaction fixed." : "\n  ✓ Prices were already correct.\n");
  }
}

main().catch(console.error);
