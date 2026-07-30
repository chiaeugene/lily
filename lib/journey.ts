import { repo } from "./repo";
import { paymentState } from "./payment";
import type { Order, PurchaseOrder, Transaction } from "./types";

export type JourneyStep = {
  stage: "quotation" | "purchase_order" | "order" | "transaction";
  id: string;
  title: string;
  status: string;
  statusTone: "ink" | "profit" | "loss" | "warn" | "muted";
  date: string;
  amount?: number;
  href: string;
};

export interface Journey {
  quotation?: Order;
  po?: PurchaseOrder;
  order?: Order;
  transaction?: Transaction;
  steps: JourneyStep[];
}

// Given any id from the pipeline (quotation, PO, order, or transaction), walks
// the links in both directions and returns every stage found. Missing stages
// are simply omitted — e.g. a plain Telegram order with no quotation/PO has
// just [order, transaction].
export async function buildJourney(rawId: string): Promise<Journey | null> {
  const id = rawId.trim();
  let quotation: Order | undefined;
  let po: PurchaseOrder | undefined;
  let order: Order | undefined;
  let transaction: Transaction | undefined;

  if (id.startsWith("QT-")) {
    quotation = await repo.getQuotation(id);
    if (!quotation) return null;
  } else if (id.startsWith("PO-")) {
    po = await repo.getPurchaseOrder(id);
    if (!po) return null;
    if (po.quotationId) quotation = await repo.getQuotation(po.quotationId);
  } else if (id.startsWith("TX-")) {
    transaction = await repo.getTransaction(id);
    if (!transaction) return null;
    order = await repo.getOrder(transaction.orderId);
  } else {
    order = await repo.getOrder(id);
    if (!order) return null;
  }

  if (quotation && !po) po = await repo.findPoByQuotationId(quotation.id);
  if (quotation && !order) order = await repo.findOrderByQuotationId(quotation.id);
  if (order?.quotationId && !quotation) quotation = await repo.getQuotation(order.quotationId);
  if (order && !transaction) transaction = await repo.findTransactionByOrderId(order.id);

  const steps: JourneyStep[] = [];

  if (quotation) {
    steps.push({
      stage: "quotation",
      id: quotation.id,
      title: `Quotation ${quotation.id}`,
      status: quotation.status === "accepted" ? "Accepted" : "Open",
      statusTone: quotation.status === "accepted" ? "profit" : "muted",
      date: quotation.date,
      amount: quotation.lines.reduce((s, l) => s + l.qty * l.sellUnitPrice - (l.disc ?? 0), 0),
      href: `/quotation/${quotation.id}`,
    });
  }

  if (po) {
    const poStatusMap = { draft: "Draft", confirmed: "Confirmed", cancelled: "Cancelled" } as const;
    steps.push({
      stage: "purchase_order",
      id: po.id,
      title: `Purchase Order ${po.id}`,
      status: poStatusMap[po.status],
      statusTone: po.status === "confirmed" ? "profit" : po.status === "cancelled" ? "muted" : "warn",
      date: po.date,
      amount: po.lines.reduce((s, l) => s + l.qty * l.unitPrice - (l.disc ?? 0), 0),
      href: `/po/${po.id}`,
    });
  }

  if (order) {
    const orderStatusMap = { pending: "Pending verification", verified: "Verified", rejected: "Rejected", quote: "Quote", accepted: "Accepted" } as const;
    steps.push({
      stage: "order",
      id: order.id,
      title: `Order ${order.id}`,
      status: orderStatusMap[order.status] ?? order.status,
      statusTone: order.status === "verified" ? "profit" : order.status === "rejected" ? "loss" : "warn",
      date: order.date,
      amount: order.lines.reduce((s, l) => s + l.qty * l.sellUnitPrice - (l.disc ?? 0), 0),
      href: `/dashboard#pending`,
    });
  }

  if (transaction) {
    const ps = transaction.status === "void" ? "void" : paymentState(transaction);
    const statusLabel = transaction.status === "void" ? "Voided" : ps === "paid" ? "Paid" : ps === "overdue" ? "Overdue" : "Unpaid";
    steps.push({
      stage: "transaction",
      id: transaction.id,
      title: `Invoice cascade ${transaction.id}`,
      status: statusLabel,
      statusTone: transaction.status === "void" ? "muted" : ps === "paid" ? "profit" : ps === "overdue" ? "loss" : "warn",
      date: transaction.date,
      amount: transaction.grandTotalSell,
      href: `/transaction/${transaction.id}`,
    });
  }

  if (!steps.length) return null;
  return { quotation, po, order, transaction, steps };
}
