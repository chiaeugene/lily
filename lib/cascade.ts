import type {
  Order,
  OrderLine,
  MarginRule,
  Invoice,
  InvoiceLine,
  Transaction,
  CompanyKey,
} from "./types";
import { COMPANIES, CHAIN } from "./companies";
import { round2, roundTo5Sen, ringgitInWords } from "./money";

/**
 * Derive the price a supplier charges, one level down the chain.
 *   selling = the buyer's own selling price (the level above)
 *   rule    = the buyer's margin
 * RM/unit: cost = selling - value
 * percent: markup-on-cost, selling = cost*(1+pct/100) => cost = selling/(1+pct/100)
 */
export function deriveUpstreamPrice(selling: number, rule: MarginRule | undefined): number {
  if (!rule) return selling; // no margin configured -> pass-through
  if (rule.type === "rm_per_unit") return Math.max(0, round2(selling - rule.value));
  return round2(selling / (1 + rule.value / 100));
}

export interface BuildOptions {
  allocateInvoiceNo: (company: CompanyKey) => string;
  marginRules: MarginRule[];
  transactionId: string;
  orderId: string;
  /** Which companies to actually generate invoices for. Defaults to all CHAIN members.
   *  Prices are always back-calculated for the full chain first so margin analytics
   *  remain correct even when only a subset of invoices is generated. */
  companies?: CompanyKey[];
}

function ruleFor(rules: MarginRule[], productId: string, layer: number) {
  return (
    rules.find((r) => r.productId === productId && r.layer === layer) ??
    rules.find((r) => r.productId === "*" && r.layer === layer)
  );
}

function finalize(company: CompanyKey, subtotal: number) {
  const c = COMPANIES[company];
  if (c.showRoundingRow) {
    const finalTotal = roundTo5Sen(subtotal);
    return { subtotal, roundingAdj: round2(finalTotal - subtotal), finalTotal };
  }
  return { subtotal, roundingAdj: 0, finalTotal: subtotal };
}

function doNoFromInvoiceNo(invoiceNo: string, prefix: string): string {
  return "DO-" + invoiceNo.slice(prefix.length);
}

/**
 * Build cascade invoices from one verified order. Fully driven by CHAIN
 * (origin -> ... -> customer-facing). Prices are always derived for every
 * company in the chain (so margin analytics stay correct), but only invoices
 * for the companies listed in opts.companies are generated and saved.
 * Bill-to is always the natural next link in the chain (last company bills
 * the end customer). omitting opts.companies generates all 3.
 */
export function buildCascade(order: Order, opts: BuildOptions): Transaction {
  const { marginRules, allocateInvoiceNo } = opts;

  // Which companies are actually being generated — always in natural CHAIN order
  // regardless of the order the user ticked them. Supply direction is fixed
  // (TNM → Prim → 3C) so reversing it would produce invalid margin math.
  const requested = opts.companies && opts.companies.length > 0 ? opts.companies : CHAIN;
  const toGenerate = CHAIN.filter((c) => requested.includes(c));
  const lastSelected  = toGenerate[toGenerate.length - 1];
  const firstSelected = toGenerate[0];

  // 1. Price walk — starts from the LAST SELECTED company at the entered sell
  //    price and back-calculates upstream through selected companies only.
  //
  //    1 selected  → that company bills at sell price (no back-calc)
  //    2 selected  → last at sell price, first one margin subtracted
  //    3 selected  → full cascade (same behaviour as before)
  //
  //    This ensures the customer always pays exactly what was entered, and only
  //    the tiers actually involved in the deal share the margin.
  const priceByCompany: Record<CompanyKey, Map<string, number>> = {
    prim: new Map(),
    "3c": new Map(),
    tien_ngai: new Map(),
  };
  for (const ol of order.lines) {
    priceByCompany[lastSelected].set(ol.productId, ol.sellUnitPrice);
    for (let i = toGenerate.length - 1; i > 0; i--) {
      const buyer  = toGenerate[i];
      const seller = toGenerate[i - 1];
      const buyerPrice = priceByCompany[buyer].get(ol.productId)!;
      // Margin is layer-based: depth 1 = customer-facing, 2 = middle, etc.
      // Whichever company sits in that slot uses the rate for that layer.
      const depth = toGenerate.length - i; // 1 = last selected, 2 = second-to-last…
      const sellerPrice = deriveUpstreamPrice(buyerPrice, ruleFor(marginRules, ol.productId, depth));
      priceByCompany[seller].set(ol.productId, sellerPrice);
    }
  }

  // 2. grandTotalSell = what the customer pays (last selected company's total).
  //    marginCaptured = spread between the last and first selected company's totals.
  function selectedSubtotal(company: CompanyKey) {
    return round2(
      order.lines.reduce((sum, ol) => {
        const unitPrice = priceByCompany[company].get(ol.productId)!;
        return sum + round2(ol.qty * unitPrice - (ol.disc ?? 0));
      }, 0),
    );
  }
  const lastFinalTotal  = finalize(lastSelected,  selectedSubtotal(lastSelected)).finalTotal;
  const firstFinalTotal = finalize(firstSelected, selectedSubtotal(firstSelected)).finalTotal;

  // 4. Who each company bills: the next *selected* company, or the end customer
  //    if this company is the last selected one. This lets TNM or Prim bill the
  //    customer directly when they are the last (or only) selected company.
  function billTo(company: CompanyKey) {
    const myIdx = toGenerate.indexOf(company);
    const nextSelected = toGenerate[myIdx + 1];
    if (!nextSelected) {
      return { name: order.customerName, addr: order.customerAddressLines, tel: order.customerTel };
    }
    const buyer = COMPANIES[nextSelected];
    return { name: buyer.name, addr: buyer.addressLines, tel: buyer.tel };
  }
  // Build invoices in tick order (toGenerate preserves the user's selection order).
  const invoices: Invoice[] = toGenerate.map((company) => {
    const c = COMPANIES[company];
    const priceMap = priceByCompany[company];
    let subtotal = 0;
    const lines: InvoiceLine[] = order.lines.map((ol, i) => {
      const unitPrice = priceMap.get(ol.productId)!;
      const disc = ol.disc ?? 0;
      const total = round2(ol.qty * unitPrice - disc);
      subtotal += total;
      return {
        item: i + 1,
        description: ol.productName,
        specLines: ol.specLines,
        qty: ol.qty,
        uom: ol.uom,
        unitPrice,
        disc,
        total,
      };
    });
    const totals = finalize(company, round2(subtotal));
    const invoiceNo = allocateInvoiceNo(company);
    const to = billTo(company);
    return {
      id: `${opts.transactionId}-${company}`,
      company,
      invoiceNo,
      doNo: doNoFromInvoiceNo(invoiceNo, c.invoicePrefix),
      yourRef: "",
      toName: to.name,
      toAddressLines: to.addr,
      toTel: to.tel,
      terms: order.terms,
      date: order.date,
      lines,
      subtotal: totals.subtotal,
      roundingAdj: totals.roundingAdj,
      finalTotal: totals.finalTotal,
      amountInWords: ringgitInWords(totals.finalTotal),
    };
  });

  return {
    id: opts.transactionId,
    orderId: opts.orderId,
    customerName: order.customerName,
    date: order.date,
    invoices,
    grandTotalSell: lastFinalTotal,
    marginCaptured: round2(lastFinalTotal - firstFinalTotal),
    createdAt: new Date().toISOString(),
  };
}
