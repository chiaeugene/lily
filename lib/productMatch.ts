// Deterministic product matcher. Maps free-form / shorthand product text from a
// Telegram or WhatsApp message onto a known catalog Product. Used by every parse
// path (structured template, AI output post-processing, offline heuristic) so
// matching behaves identically everywhere and is testable without an API key.

import type { Product } from "./types";

// Shorthand → canonical, applied before tokenising.
const SYNONYMS: [RegExp, string][] = [
  [/\bJRT\b/g, " JUMBO ROLL TISSUE "],
  [/\bH\.?R\.?T\b/g, " HAND ROLL TOWEL "],
  [/CORDLESS/g, "CORELESS"],          // common mishear
  [/CORELESS?\b/g, "CORELESS"],
  [/LUCHEON|LUNCHON/g, "LUNCHEON"],
  [/\bNCR\b/g, "CARBONLESS"],
  [/WOOD\s*FREE|HI[\s-]*WHITE|WHOLE\s*FRAME/g, "HI-WHITE"],
  [/M[\s-]*FOLD|MULTI[\s-]*FOLD/g, "M-FOLD"],
  [/SERVIET+E?/g, "SERVIETTE"],
  [/NAPKINS/g, "NAPKIN"],
  [/THERMA?L?\b/g, "THERMAL"],
  [/REGISTERS?/g, "REGISTER"],
  [/PRINTED|PRINTING/g, "PRINTED"],
  // Mandarin product terms (Malaysian rojak) → English, applied before non-Latin
  // characters are stripped out below.
  [/热敏纸|感热纸|热感纸/g, " THERMAL PAPER ROLL "],
  [/无芯/g, " CORELESS "],
  [/收银纸|收据纸/g, " CASH REGISTER ROLL "],
  [/鸡尾酒/g, " COCKTAIL "],
  [/午餐/g, " LUNCHEON "],
  [/晚餐/g, " DINNER "],
  [/餐巾纸|餐巾/g, " NAPKIN "],
  [/大卷纸|卷筒纸|卷纸/g, " JUMBO ROLL TISSUE "],
  [/双层|二层|2层/g, " 2PLY "],
  [/单层|一层|1层/g, " 1PLY "],
];

// Significant family keywords (single words) we score on.
const FAMILY = [
  "COCKTAIL", "LUNCHEON", "DINNER", "NAPKIN", "SERVIETTE",
  "JUMBO", "TISSUE", "TOILET", "TOWEL", "M-FOLD",
  "THERMAL", "CORELESS", "REGISTER", "CARBONLESS", "HI-WHITE", "PRINTED", "PAPER", "ROLL",
];

export function normalize(s: string): string {
  let t = ` ${(s || "").toUpperCase()} `;
  for (const [re, rep] of SYNONYMS) t = t.replace(re, rep);
  return t.replace(/[^A-Z0-9.\- ]/g, " ").replace(/\s+/g, " ").trim();
}

// Units glued to numbers that we strip so digits stand alone (57MM, 48GSM,
// 57MMX38MMX12MM, 200R/CTN, 10IN1 PACK, 2PLY).
const UNIT = /\b(MM|CM|GSM|KG|G|M|R|CTN|PKT|PKTS|PCS|IN|PACK|PLY|ROLLS?)\b/g;

/** Collect the significant dimension/grade numbers from a normalized string. */
export function dimNumbers(norm: string): Set<number> {
  const set = new Set<number>();
  // separate digits from glued letters, then drop unit words so X-groups surface
  let s = norm
    .replace(/(\d)(?=[A-Z])/g, "$1 ")
    .replace(/([A-Z])(?=\d)/g, "$1 ")
    .replace(UNIT, " ");
  // explicit N x M (x K) groups
  const grp = /(\d{2,3})\s*[X*]\s*(\d{2,3})(?:\s*[X*]\s*(\d{1,3}))?/g;
  let m: RegExpExecArray | null;
  while ((m = grp.exec(s))) {
    for (const g of [m[1], m[2], m[3]]) if (g) set.add(Number(g));
  }
  s = s.replace(grp, " ");
  // 4-digit shorthand codes like 5740 / 5760 → 57,40 / 57,60
  for (const c of s.match(/\b\d{4}\b/g) ?? []) {
    set.add(Number(c.slice(0, 2)));
    set.add(Number(c.slice(2)));
    s = s.replace(c, " ");
  }
  // standalone 2-3 digit grades/widths (48, 225, 80, 76)
  for (const n of s.match(/\d{2,3}/g) ?? []) set.add(Number(n));
  return set;
}

function ply(norm: string): number | null {
  const m = norm.match(/\b([123])\s*PLY\b/);
  if (m) return Number(m[1]);
  if (/\bSINGLE\b/.test(norm)) return 1;
  if (/\bDOUBLE\b/.test(norm)) return 2;
  return null;
}

export interface ProductMatch { product: Product; score: number }

/** Best-scoring catalog product for a free-form query, or null if nothing fits. */
export function matchProduct(query: string, products: Product[]): ProductMatch | null {
  const q = normalize(query);
  if (!q) return null;
  const qNums = dimNumbers(q);
  const qPly = ply(q);

  let best: ProductMatch | null = null;
  for (const p of products) {
    const pNorm = normalize(`${p.name} ${p.specLines.join(" ")}`);
    const pNums = dimNumbers(pNorm);
    const pPly = ply(pNorm);

    let score = 0;
    // dimension overlap (strongest signal)
    for (const n of qNums) if (pNums.has(n)) score += 4;
    // specificity: when the query names sizes, penalise extra sizes the product
    // carries that the query didn't ask for, so the closest variant wins
    // (e.g. "80x80" beats "80x60"). Skipped for dimensionless queries.
    if (qNums.size) for (const n of pNums) if (!qNums.has(n)) score -= 1;
    // family keyword overlap
    for (const f of FAMILY) if (pNorm.includes(f) && q.includes(f)) score += 3;
    // ply agreement / disagreement
    if (qPly && pPly) score += qPly === pPly ? 2 : -4;

    if (!best || score > best.score) best = { product: p, score };
  }
  // require a real signal: at least one family keyword or one dimension match.
  return best && best.score >= 3 ? best : null;
}
