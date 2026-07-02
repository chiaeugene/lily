// ── Product catalog (single source of truth) ────────────────────────────────
// Anchored to three REAL invoices (the format we must honour):
//   • Tien Ngai INV-187880: THERMAL PAPER 48GSM 225MM | 59.5KG-1ROLL / 58.5KG-1ROLL | 118 KGS @ 8.00
//   • 3C  INV-2603/007:     COCKTAIL NAPKIN 2PLY PLAIN 23CM X 23CM | 20PKTS X 250'S | 10 BOXES @ 85.00
//   • Prim I-2606/0004:     CORELESS THERMAL PAPER BLANK ROLL | 57MMX38MMX12MM / 10IN1 PACK / 200R/CTN | 68 BOXES @ 54.50
//
// Naming convention learned from the anchors: the `name` is the bold invoice
// "Description"; size lives in the name for napkins & jumbo, but on a spec
// sub-line for the coreless roll (we keep each anchor SKU byte-faithful, and
// give expanded variants a unique name so the catalog/parser stay unambiguous).
// UOM: finished goods by BOXES, jumbo roll tissue by CTN, thermal jumbo by KGS.
//
// Families (the client sells three): TISSUE, PAPER ROLLS, + a 45x85 roll.
// Seeded into Supabase via scripts/load-catalog.ts and into the demo store.
// IDs are the stable SKU key (margin rules + parser) — never renumber.

import type { Product, MarginRule } from "./types";

export const SEED_PRODUCTS: Product[] = [
  // ── Tissue — napkins (by BOXES) ──────────────────────────────────────────────
  { id: "nap-cocktail-1ply", name: "COCKTAIL NAPKIN 1PLY PLAIN 23CM X 23CM", specLines: ["20PKTS X 250'S"], uom: "BOXES" },
  { id: "nap-cocktail-2ply", name: "COCKTAIL NAPKIN 2PLY PLAIN 23CM X 23CM", specLines: ["20PKTS X 250'S"], uom: "BOXES" }, // ANCHOR @ 85.00
  { id: "nap-luncheon-1ply", name: "LUNCHEON NAPKIN 1PLY PLAIN 30CM X 30CM", specLines: ["20PKTS X 100'S"], uom: "BOXES" },
  { id: "nap-luncheon-2ply", name: "LUNCHEON NAPKIN 2PLY PLAIN 30CM X 30CM", specLines: ["20PKTS X 100'S"], uom: "BOXES" },
  { id: "nap-dinner-1ply",   name: "DINNER NAPKIN 1PLY PLAIN 40CM X 40CM",   specLines: ["20PKTS X 100'S"], uom: "BOXES" },
  { id: "nap-dinner-2ply",   name: "DINNER NAPKIN 2PLY PLAIN 40CM X 40CM",   specLines: ["20PKTS X 100'S"], uom: "BOXES" },

  // ── Tissue — serviette (by pack weight) & away-from-home rolls/towels ────────
  { id: "serviette-80g", name: "SERVIETTE PAPER 80G", specLines: [], uom: "BOXES" },
  { id: "serviette-40g", name: "SERVIETTE PAPER 40G", specLines: [], uom: "BOXES" },
  { id: "jrt-1ply", name: "JUMBO ROLL TISSUE 1PLY", specLines: ["12ROLLS/CTN"], uom: "CTN" },
  { id: "jrt-2ply", name: "JUMBO ROLL TISSUE 2PLY", specLines: ["12ROLLS/CTN"], uom: "CTN" },
  { id: "mfold-handtowel", name: "M-FOLD HAND TOWEL", specLines: ["20PKTS/CTN"], uom: "CTN" },
  { id: "toilet-roll-2ply", name: "TOILET ROLL 2PLY", specLines: ["10R X 10"], uom: "CTN" },

  // ── Paper rolls — thermal receipt (blank, with core) ─────────────────────────
  { id: "th-57x40", name: "THERMAL PAPER ROLL 57MM X 40MM", specLines: [], uom: "BOXES" },
  { id: "th-57x50", name: "THERMAL PAPER ROLL 57MM X 50MM", specLines: [], uom: "BOXES" },
  { id: "th-57x60", name: "THERMAL PAPER ROLL 57MM X 60MM", specLines: [], uom: "BOXES" },
  { id: "th-80x60", name: "THERMAL PAPER ROLL 80MM X 60MM", specLines: [], uom: "BOXES" },
  { id: "th-80x70", name: "THERMAL PAPER ROLL 80MM X 70MM", specLines: [], uom: "BOXES" },
  { id: "th-80x80", name: "THERMAL PAPER ROLL 80MM X 80MM", specLines: [], uom: "BOXES" },

  // ── Paper rolls — coreless thermal (blank) ───────────────────────────────────
  // Anchor: keep name type-only, size on spec lines (matches Prim I-2606/0004).
  { id: "coreless-57-38-12", name: "CORELESS THERMAL PAPER BLANK ROLL", specLines: ["57MMX38MMX12MM", "10IN1 PACK", "200R/CTN"], uom: "BOXES" }, // ANCHOR @ 54.50
  { id: "coreless-80-51",    name: "CORELESS THERMAL PAPER BLANK ROLL 80MM X 51MM", specLines: ["BY METER"], uom: "BOXES" },

  // ── Paper rolls — printed thermal ────────────────────────────────────────────
  { id: "th-printed", name: "THERMAL PAPER ROLL - CUSTOM PRINTED", specLines: [], uom: "BOXES" },

  // ── Paper rolls — cash register (bond / carbonless) ─────────────────────────
  { id: "cr-76x65-1ply", name: "CASH REGISTER ROLL 1PLY HI-WHITE 76MM X 65MM X 12MM",        specLines: ["100R/CTN"], uom: "BOXES" },
  { id: "cr-76x65-2ply", name: "CASH REGISTER ROLL 2PLY CARBONLESS (W/Y) 76MM X 65MM X 12MM", specLines: ["100R/CTN"], uom: "BOXES" },

  // ── Paper roll — 45x85 ("paper cord", confirmed a roll) ─────────────────────
  { id: "roll-45x85", name: "PAPER ROLL 45MM X 85MM", specLines: [], uom: "BOXES" },

  // ── Thermal jumbo / master roll (by KG) ─────────────────────────────────────
  { id: "tp-48-225", name: "THERMAL PAPER 48GSM 225MM", specLines: ["59.5KG-1ROLL", "58.5KG-1ROLL"], uom: "KGS" }, // ANCHOR @ 8.00
];

// ── Margin rules ─────────────────────────────────────────────────────────────
// Layer 1 = customer-facing margin (outermost). Layer 2 = inner/middle margin.
// Real anchors kept verbatim; everything else gets a 5% default per layer.
const REAL_RULES: MarginRule[] = [
  { productId: "tp-48-225",        layer: 1, type: "rm_per_unit", value: 0.4 },
  { productId: "tp-48-225",        layer: 2, type: "rm_per_unit", value: 0.4 },
  { productId: "coreless-57-38-12", layer: 1, type: "rm_per_unit", value: 3.0 },
  { productId: "coreless-57-38-12", layer: 2, type: "rm_per_unit", value: 3.0 },
];

const DEFAULT_PERCENT = 5;

export const SEED_MARGIN_RULES: MarginRule[] = SEED_PRODUCTS.flatMap((p) =>
  [1, 2].map((layer) => {
    const real = REAL_RULES.find((r) => r.productId === p.id && r.layer === layer);
    return real ?? { productId: p.id, layer, type: "percent" as const, value: DEFAULT_PERCENT };
  }),
);
