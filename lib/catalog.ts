// ── Product catalog (single source of truth) ────────────────────────────────
// The client (Tien Ngai group) sells three families: TISSUE, PAPER ROLLS, and
// a 45x85 paper roll. Names are uppercase exactly as they should print on the
// invoice "Description"; size lives in the name (matching the jumbo precedent),
// while specLines carry pack config / roll weights. UOM: finished goods by
// BOX/CTN, jumbo master roll by KG.
//
// Seeded into Supabase via scripts/load-catalog.ts and into the demo store.
// IDs are stable — never renumber an existing id (invoices denormalize at
// creation, so renames here never alter past invoices, but ids are the SKU key
// used by margin rules and the parser).

import type { Product } from "./types";

export const SEED_PRODUCTS: Product[] = [
  // ── Tissue ─────────────────────────────────────────────────────────────────
  { id: "nap-cocktail-1ply", name: "COCKTAIL NAPKIN 1PLY PLAIN 23CM X 23CM", specLines: ["20PKTS X 250'S"], uom: "BOXES" },
  { id: "nap-cocktail-2ply", name: "COCKTAIL NAPKIN 2PLY PLAIN 23CM X 23CM", specLines: ["20PKTS X 250'S"], uom: "BOXES" },
  { id: "nap-luncheon-1ply", name: "LUNCHEON NAPKIN 1PLY PLAIN 30CM X 30CM", specLines: [], uom: "BOXES" },
  { id: "nap-luncheon-2ply", name: "LUNCHEON NAPKIN 2PLY PLAIN 30CM X 30CM", specLines: [], uom: "BOXES" },
  { id: "nap-dinner-1ply",   name: "DINNER NAPKIN 1PLY PLAIN 40CM X 40CM",   specLines: [], uom: "BOXES" },
  { id: "nap-dinner-2ply",   name: "DINNER NAPKIN 2PLY PLAIN 40CM X 40CM",   specLines: [], uom: "BOXES" },
  { id: "jrt-1ply", name: "JUMBO ROLL TISSUE 1PLY", specLines: [], uom: "CTN" },
  { id: "jrt-2ply", name: "JUMBO ROLL TISSUE 2PLY", specLines: [], uom: "CTN" },
  { id: "serviette-80g", name: "SERVIETTE PAPER 80G", specLines: [], uom: "CTN" },
  { id: "serviette-40g", name: "SERVIETTE PAPER 40G", specLines: [], uom: "CTN" },

  // ── Paper rolls — thermal (blank, with core) ────────────────────────────────
  { id: "th-57x40", name: "THERMAL PAPER ROLL 57MM X 40MM", specLines: [], uom: "BOXES" },
  { id: "th-57x60", name: "THERMAL PAPER ROLL 57MM X 60MM", specLines: [], uom: "BOXES" },
  { id: "th-80x60", name: "THERMAL PAPER ROLL 80MM X 60MM", specLines: [], uom: "BOXES" },
  { id: "th-80x80", name: "THERMAL PAPER ROLL 80MM X 80MM", specLines: [], uom: "BOXES" },

  // ── Paper rolls — thermal (coreless / blank) ────────────────────────────────
  { id: "coreless-57-38-12", name: "CORELESS THERMAL PAPER BLANK ROLL 57MM X 38MM X 12MM", specLines: ["10 IN 1 PACK", "200R/CTN"], uom: "BOXES" },
  { id: "coreless-80-51",    name: "CORELESS THERMAL PAPER BLANK ROLL 80MM X 51MM",         specLines: ["BY METER"], uom: "BOXES" },

  // ── Paper rolls — printed thermal ───────────────────────────────────────────
  { id: "th-printed", name: "THERMAL PAPER ROLL - CUSTOM PRINTED", specLines: [], uom: "BOXES" },

  // ── Paper rolls — cash register (bond / carbonless) ─────────────────────────
  { id: "cr-76x65-1ply", name: "CASH REGISTER ROLL HI-WHITE 76MM X 65MM X 12MM 1PLY",        specLines: ["100R/CTN"], uom: "BOXES" },
  { id: "cr-76x65-2ply", name: "CASH REGISTER ROLL CARBONLESS 76MM X 65MM X 12MM 2PLY (W/Y)", specLines: ["100R/CTN"], uom: "BOXES" },

  // ── Paper roll — 45x85 ("paper cord", confirmed a roll) ─────────────────────
  { id: "roll-45x85", name: "PAPER ROLL 45MM X 85MM", specLines: [], uom: "BOXES" },

  // ── Thermal jumbo / master roll (by KG) — existing ──────────────────────────
  { id: "tp-48-225", name: "THERMAL PAPER 48GSM 225MM", specLines: ["59.5KG-1ROLL", "58.5KG-1ROLL"], uom: "KGS" },
];
