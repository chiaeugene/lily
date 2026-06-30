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

function ruleFor(rules: MarginRule[], productId: string, company: CompanyKey) {
  return (
    rules.find((r) => r.productId === productId && r.tier === company) ??
    rules.find((r) => r.productId === "*" && r.tier === company)
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
  const lastIdx = CHAIN.length - 1;
  const customerFacing = CHAIN[lastIdx];
  const origin = CHAIN[0];

  // 1. Selling unit price for every company, per line, walked down the chain.
  //    priceByCompany[company].get(productId) = unit price that company charges its buyer.
  const priceByCompany: Record<CompanyKey, Map<string, number>> = {
    prim: new Map(),
    "3c": new Map(),
    tien_ngai: new Map(),
  };
  for (const ol of order.lines) {
    priceByCompany[customerFacing].set(ol.productId, ol.sellUnitPrice);
    for (let i = lastIdx; i > 0; i--) {
      const buyer = CHAIN[i];
      const seller = CHAIN[i - 1];
      const buyerPrice = priceByCompany[buyer].get(ol.productId)!;
      const sellerPrice = deriveUpstreamPrice(buyerPrice, ruleFor(marginRules, ol.productId, buyer));
      priceByCompany[seller].set(ol.productId, sellerPrice);
    }
  }

  // 2. Compute grandTotalSell / marginCaptured from full chain (always, regardless
  //    of which invoices are generated so analytics are never skewed).
  function chainSubtotal(company: CompanyKey) {
    return round2(
      order.lines.reduce((sum, ol) => {
        const unitPrice = priceByCompany[company].get(ol.productId)!;
        return sum + round2(ol.qty * unitPrice - (ol.disc ?? 0));
      }, 0),
    );
  }
  const customerFinalTotal = finalize(customerFacing, chainSubtotal(customerFacing)).finalTotal;
  const originFinalTotal   = finalize(origin,         chainSubtotal(origin)).finalTotal;

  // 3. Who each company bills: the next company up the chain, except the
  //    customer-facing company, which bills the end customer.
  function billTo(company: CompanyKey) {
    const idx = CHAIN.indexOf(company);
    if (idx === lastIdx) {
      return { name: order.customerName, addr: order.customerAddressLines, tel: order.customerTel };
    }
    const buyer = COMPANIES[CHAIN[idx + 1]];
    return { name: buyer.name, addr: buyer.addressLines, tel: buyer.tel };
  }

  // 4. Build invoices only for the requested companies (CHAIN order preserved).
  const toGenerate = opts.companies && opts.companies.length > 0 ? opts.companies : CHAIN;
  const invoices: Invoice[] = CHAIN.filter((c) => toGenerate.includes(c)).map((company) => {
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
    grandTotalSell: customerFinalTotal,
    marginCaptured: round2(customerFinalTotal - originFinalTotal),
    createdAt: new Date().toISOString(),
  };
}
