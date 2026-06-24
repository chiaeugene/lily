// Repository layer. Today it is backed by the seeded in-memory store so the app
// is fully usable without external services. The function surface is written so
// a Supabase-backed implementation can drop in unchanged (see supabase/schema.sql).

import { store } from "./store";
import { buildCascade } from "./cascade";
import { formatInvoiceNo } from "./invoiceNumber";
import { COMPANIES, CHAIN } from "./companies";
import type {
  Customer,
  Product,
  MarginRule,
  Order,
  Transaction,
  AuditEntry,
  CompanyKey,
  Company,
} from "./types";

export const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;

function log(actor: string, action: string, detail: string) {
  const entry: AuditEntry = {
    id: `a${store.audit.length + 1}`,
    at: new Date().toISOString(),
    actor,
    action,
    detail,
  };
  store.audit.unshift(entry);
}

export const repo = {
  // ── companies ────────────────────────────────────────────
  listCompanies: (): Company[] => CHAIN.map((k) => COMPANIES[k]),
  getCompany: (key: CompanyKey): Company => COMPANIES[key],
  updateCompany(key: CompanyKey, patch: Partial<Company>) {
    const allowed: (keyof Company)[] = [
      "name", "regNo", "tinNo", "formerlyKnownAs", "addressLines", "tel", "email", "banks",
    ];
    const target = COMPANIES[key] as unknown as Record<string, unknown>;
    const src = patch as Record<string, unknown>;
    for (const k of allowed) {
      if (k in patch && src[k] !== undefined) {
        target[k] = src[k];
      }
    }
    log("admin", "company.update", `${key}: ${Object.keys(patch).join(", ")}`);
  },

  // ── catalog ──────────────────────────────────────────────
  listCustomers: (): Customer[] => store.customers,
  listProducts: (): Product[] => store.products,
  listMarginRules: (): MarginRule[] => store.marginRules,
  getProduct: (id: string) => store.products.find((p) => p.id === id),

  upsertMarginRule(rule: MarginRule) {
    const i = store.marginRules.findIndex(
      (r) => r.productId === rule.productId && r.tier === rule.tier,
    );
    if (i >= 0) store.marginRules[i] = rule;
    else store.marginRules.push(rule);
    log("admin", "margin.update", `${rule.productId}/${rule.tier} -> ${rule.value} ${rule.type}`);
  },

  // ── orders ───────────────────────────────────────────────
  listPendingOrders: (): Order[] => store.orders.filter((o) => o.status === "pending"),
  getOrder: (id: string) => store.orders.find((o) => o.id === id),
  addOrder(order: Order) {
    store.orders.unshift(order);
    log(order.telegramUser ?? "telegram", "order.received", `${order.id} from ${order.customerName}`);
  },

  // ── transactions ─────────────────────────────────────────
  recentTransactions: (n = 10): Transaction[] => store.transactions.slice(0, n),
  allTransactions: (): Transaction[] => store.transactions,
  getTransaction: (id: string) => store.transactions.find((t) => t.id === id),
  getInvoice(invoiceId: string) {
    for (const t of store.transactions) {
      const inv = t.invoices.find((i) => i.id === invoiceId);
      if (inv) return { invoice: inv, transaction: t };
    }
    return undefined;
  },

  /** Verify a pending order: build the 3-invoice cascade and persist it. */
  verifyOrder(orderId: string, actor = "admin"): Transaction | undefined {
    const order = store.orders.find((o) => o.id === orderId);
    if (!order) return undefined;

    const txId = `TX-${Date.now().toString(36).toUpperCase()}`;
    const tx = buildCascade(order, {
      transactionId: txId,
      orderId: order.id,
      marginRules: store.marginRules,
      allocateInvoiceNo: (company: CompanyKey) => {
        store.counters[company] += 1;
        return formatInvoiceNo(company, store.counters[company]);
      },
    });
    order.status = "verified";
    store.transactions.unshift(tx);
    log(
      actor,
      "order.verified",
      `${order.id} -> ${tx.id}: ${tx.invoices.map((i) => `${i.company} ${i.invoiceNo}`).join(", ")}`,
    );
    return tx;
  },

  rejectOrder(orderId: string, actor = "admin") {
    const order = store.orders.find((o) => o.id === orderId);
    if (order) {
      order.status = "rejected";
      log(actor, "order.rejected", order.id);
    }
  },

  // ── search & analytics ───────────────────────────────────
  search(q: string) {
    const needle = q.trim().toLowerCase();
    if (!needle) return [] as Transaction[];
    return store.transactions.filter((t) => {
      if (t.customerName.toLowerCase().includes(needle)) return true;
      if (t.id.toLowerCase().includes(needle)) return true;
      return t.invoices.some(
        (i) =>
          i.invoiceNo.toLowerCase().includes(needle) ||
          i.lines.some((l) => l.description.toLowerCase().includes(needle)),
      );
    });
  },

  kpis() {
    const txs = store.transactions;
    const todaySell = txs.reduce((s, t) => s + t.grandTotalSell, 0);
    const margin = txs.reduce((s, t) => s + t.marginCaptured, 0);
    return {
      pending: repo.listPendingOrders().length,
      transactions: txs.length,
      totalSell: todaySell,
      marginCaptured: margin,
    };
  },

  audit: (n = 20): AuditEntry[] => store.audit.slice(0, n),
};
