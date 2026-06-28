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
 * Build the cascade invoices from one verified order. Fully driven by CHAIN
 * (origin -> ... -> customer-facing). The customer-facing company (last in
 * CHAIN) sells to the customer at the order's sell price; each company upstream
 * is derived by subtracting the buyer's margin.
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

  // 2. Who each company bills: the next company up the chain, except the
  //    customer-facing company, which bills the end customer.
  function billTo(company: CompanyKey) {
    const idx = CHAIN.indexOf(company);
    if (idx === lastIdx) {
      return { name: order.customerName, addr: order.customerAddressLines, tel: order.customerTel };
    }
    const buyer = COMPANIES[CHAIN[idx + 1]];
    return { name: buyer.name, addr: buyer.addressLines, tel: buyer.tel };
  }

  // 3. Build one invoice per company (kept in CHAIN order: origin first).
  const invoices: Invoice[] = CHAIN.map((company) => {
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

  const customerInv = invoices.find((i) => i.company === customerFacing)!;
  const originInv = invoices.find((i) => i.company === origin)!;
  return {
    id: opts.transactionId,
    orderId: opts.orderId,
    customerName: order.customerName,
    date: order.date,
    invoices,
    grandTotalSell: customerInv.finalTotal,
    marginCaptured: round2(customerInv.finalTotal - originInv.finalTotal),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build a single invoice for one chosen company, billing the end customer at
 * the order's sell price (no margin back-calculation). Used when the operator
 * only needs one invoice rather than the full cascade.
 */
export function buildSingleInvoice(
  order: Order,
  company: CompanyKey,
  opts: BuildOptions,
): Transaction {
  const c = COMPANIES[company];
  let subtotal = 0;
  const lines: InvoiceLine[] = order.lines.map((ol, i) => {
    const disc = ol.disc ?? 0;
    const total = round2(ol.qty * ol.sellUnitPrice - disc);
    subtotal += total;
    return {
      item: i + 1,
      description: ol.productName,
      specLines: ol.specLines,
      qty: ol.qty,
      uom: ol.uom,
      unitPrice: ol.sellUnitPrice,
      disc,
      total,
    };
  });
  const totals = finalize(company, round2(subtotal));
  const invoiceNo = opts.allocateInvoiceNo(company);
  const invoice: Invoice = {
    id: `${opts.transactionId}-${company}`,
    company,
    invoiceNo,
    doNo: doNoFromInvoiceNo(invoiceNo, c.invoicePrefix),
    yourRef: "",
    toName: order.customerName,
    toAddressLines: order.customerAddressLines,
    toTel: order.customerTel,
    terms: order.terms,
    date: order.date,
    lines,
    subtotal: totals.subtotal,
    roundingAdj: totals.roundingAdj,
    finalTotal: totals.finalTotal,
    amountInWords: ringgitInWords(totals.finalTotal),
  };
  return {
    id: opts.transactionId,
    orderId: opts.orderId,
    customerName: order.customerName,
    date: order.date,
    invoices: [invoice],
    grandTotalSell: invoice.finalTotal,
    marginCaptured: 0,
    createdAt: new Date().toISOString(),
  };
}
