// Repository layer. In demo mode (no NEXT_PUBLIC_SUPABASE_URL) it uses the
// seeded in-memory store so the app is fully usable without external services.
// When the env var is present every method reads/writes Supabase instead.
// All methods are async so both backends share the same call-site signature.

import { store } from "./store";
import { buildCascade } from "./cascade";
import { formatInvoiceNo } from "./invoiceNumber";
import { COMPANIES, CHAIN } from "./companies";
import { getSupabaseAdmin } from "./supabase";
import type {
  Customer,
  Product,
  MarginRule,
  Order,
  OrderLine,
  Transaction,
  Invoice,
  InvoiceLine,
  AuditEntry,
  CompanyKey,
  Company,
} from "./types";

export const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;

// ── helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToOrder(r: any): Order {
  return {
    id: r.id,
    source: r.source,
    rawMessage: r.raw_message ?? undefined,
    telegramUser: r.telegram_user ?? undefined,
    customerId: r.customer_id ?? undefined,
    customerName: r.customer_name,
    customerAddressLines: r.customer_address_lines ?? [],
    customerTel: r.customer_tel ?? undefined,
    terms: r.terms,
    date: r.date,
    lines: r.lines as OrderLine[],
    status: r.status,
    parseConfidence: r.parse_confidence ?? undefined,
    parseNotes: r.parse_notes ?? undefined,
    createdAt: r.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToInvoice(r: any): Invoice {
  return {
    id: r.id,
    company: r.company as CompanyKey,
    invoiceNo: r.invoice_no,
    doNo: r.do_no,
    yourRef: r.your_ref ?? "",
    toName: r.to_name,
    toAddressLines: r.to_address_lines ?? [],
    toTel: r.to_tel ?? undefined,
    toFax: r.to_fax ?? undefined,
    terms: r.terms,
    date: r.date,
    lines: r.lines as InvoiceLine[],
    subtotal: Number(r.subtotal),
    roundingAdj: Number(r.rounding_adj),
    finalTotal: Number(r.final_total),
    amountInWords: r.amount_in_words,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTransaction(r: any, invoices: Invoice[]): Transaction {
  return {
    id: r.id,
    orderId: r.order_id,
    customerName: r.customer_name,
    date: r.date,
    invoices,
    grandTotalSell: Number(r.grand_total_sell),
    marginCaptured: Number(r.margin_captured),
    createdAt: r.created_at,
    status: (r.status as "active" | "void") ?? "active",
    voidReason: r.void_reason ?? undefined,
    voidedAt: r.voided_at ?? undefined,
  };
}

async function fetchTransactionWithInvoices(
  txRow: Record<string, unknown>,
): Promise<Transaction> {
  const db = getSupabaseAdmin();
  const { data: invRows } = await db
    .from("invoices")
    .select("*")
    .eq("transaction_id", txRow.id)
    .order("id");
  const invoices = (invRows ?? []).map(rowToInvoice);
  return rowToTransaction(txRow, invoices);
}

// Maps an Order to its snake_case `orders` table row (used by inserts).
function orderRow(o: Order) {
  return {
    id: o.id,
    source: o.source,
    raw_message: o.rawMessage ?? null,
    telegram_user: o.telegramUser ?? null,
    customer_id: o.customerId ?? null,
    customer_name: o.customerName,
    customer_address_lines: o.customerAddressLines,
    customer_tel: o.customerTel ?? null,
    terms: o.terms,
    date: o.date,
    lines: o.lines,
    status: o.status,
    parse_confidence: o.parseConfidence ?? null,
    parse_notes: o.parseNotes ?? null,
    created_at: o.createdAt,
  };
}

// ── in-memory audit helper ────────────────────────────────────────────────────

function memLog(actor: string, action: string, detail: string) {
  const entry: AuditEntry = {
    id: `a${store.audit.length + 1}`,
    at: new Date().toISOString(),
    actor,
    action,
    detail,
  };
  store.audit.unshift(entry);
}

async function dbLog(actor: string, action: string, detail: string) {
  await getSupabaseAdmin()
    .from("audit_log")
    .insert({ actor, action, detail })
    .then(() => {});
}

async function log(actor: string, action: string, detail: string) {
  if (isDemoMode) memLog(actor, action, detail);
  else await dbLog(actor, action, detail);
}

// ── repo ──────────────────────────────────────────────────────────────────────

export const repo = {
  // ── companies (always from the in-memory COMPANIES object) ────────────────
  listCompanies: async (): Promise<Company[]> => CHAIN.map((k) => COMPANIES[k]),
  getCompany: async (key: CompanyKey): Promise<Company> => COMPANIES[key],

  async updateCompany(key: CompanyKey, patch: Partial<Company>) {
    const allowed: (keyof Company)[] = [
      "name", "regNo", "tinNo", "formerlyKnownAs", "addressLines", "tel", "email", "banks",
    ];
    // always update the in-memory object so the current session reflects it
    const target = COMPANIES[key] as unknown as Record<string, unknown>;
    const src = patch as Record<string, unknown>;
    for (const k of allowed) {
      if (k in patch && src[k] !== undefined) target[k] = src[k];
    }
    if (!isDemoMode) {
      // persist to Supabase companies table (snake_case columns)
      const db = getSupabaseAdmin();
      const upsert: Record<string, unknown> = { key };
      if ("name" in patch) upsert.name = patch.name;
      if ("regNo" in patch) upsert.reg_no = patch.regNo;
      if ("tinNo" in patch) upsert.tin_no = patch.tinNo;
      if ("formerlyKnownAs" in patch) upsert.formerly_known_as = patch.formerlyKnownAs;
      if ("addressLines" in patch) upsert.address_lines = patch.addressLines;
      if ("tel" in patch) upsert.tel = patch.tel;
      if ("email" in patch) upsert.email = patch.email;
      if ("banks" in patch) upsert.banks = patch.banks;
      await db.from("companies").upsert(upsert);
    }
    await log("admin", "company.update", `${key}: ${Object.keys(patch).join(", ")}`);
  },

  // ── catalog ───────────────────────────────────────────────────────────────
  async listCustomers(): Promise<Customer[]> {
    if (isDemoMode) return store.customers;
    const { data } = await getSupabaseAdmin().from("customers").select("*").order("name");
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      addressLines: r.address_lines ?? [],
      tel: r.tel ?? undefined,
      fax: r.fax ?? undefined,
    }));
  },

  async listProducts(): Promise<Product[]> {
    if (isDemoMode) return store.products;
    const { data } = await getSupabaseAdmin().from("products").select("*").order("name");
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      specLines: r.spec_lines ?? [],
      uom: r.uom,
    }));
  },

  async listMarginRules(): Promise<MarginRule[]> {
    if (isDemoMode) return store.marginRules;
    const { data } = await getSupabaseAdmin().from("margin_rules").select("*");
    return (data ?? []).map((r) => ({
      productId: r.product_id,
      tier: r.tier as CompanyKey,
      type: r.type as "rm_per_unit" | "percent",
      value: Number(r.value),
    }));
  },

  async getProduct(id: string): Promise<Product | undefined> {
    if (isDemoMode) return store.products.find((p) => p.id === id);
    const { data } = await getSupabaseAdmin().from("products").select("*").eq("id", id).single();
    if (!data) return undefined;
    return { id: data.id, name: data.name, specLines: data.spec_lines ?? [], uom: data.uom };
  },

  async upsertMarginRule(rule: MarginRule): Promise<void> {
    if (isDemoMode) {
      const i = store.marginRules.findIndex(
        (r) => r.productId === rule.productId && r.tier === rule.tier,
      );
      if (i >= 0) store.marginRules[i] = rule;
      else store.marginRules.push(rule);
    } else {
      await getSupabaseAdmin().from("margin_rules").upsert({
        product_id: rule.productId,
        tier: rule.tier,
        type: rule.type,
        value: rule.value,
      });
    }
    await log("admin", "margin.update", `${rule.productId}/${rule.tier} -> ${rule.value} ${rule.type}`);
  },

  // ── orders ────────────────────────────────────────────────────────────────
  async listPendingOrders(): Promise<Order[]> {
    if (isDemoMode) return store.orders.filter((o) => o.status === "pending");
    const { data } = await getSupabaseAdmin()
      .from("orders")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    return (data ?? []).map(rowToOrder);
  },

  async getOrder(id: string): Promise<Order | undefined> {
    if (isDemoMode) return store.orders.find((o) => o.id === id);
    const { data } = await getSupabaseAdmin().from("orders").select("*").eq("id", id).single();
    return data ? rowToOrder(data) : undefined;
  },

  async addOrder(order: Order): Promise<void> {
    if (isDemoMode) {
      store.orders.unshift(order);
    } else {
      await getSupabaseAdmin().from("orders").insert({
        id: order.id,
        source: order.source,
        raw_message: order.rawMessage ?? null,
        telegram_user: order.telegramUser ?? null,
        customer_id: order.customerId ?? null,
        customer_name: order.customerName,
        customer_address_lines: order.customerAddressLines,
        customer_tel: order.customerTel ?? null,
        terms: order.terms,
        date: order.date,
        lines: order.lines,
        status: order.status,
        parse_confidence: order.parseConfidence ?? null,
        parse_notes: order.parseNotes ?? null,
        created_at: order.createdAt,
      });
    }
    await log(
      order.telegramUser ?? "telegram",
      "order.received",
      `${order.id} from ${order.customerName}`,
    );
  },

  async patchOrder(
    id: string,
    updates: { customerName?: string; date?: string; lines?: OrderLine[] },
  ): Promise<void> {
    if (isDemoMode) {
      const o = store.orders.find((x) => x.id === id);
      if (!o) return;
      if (updates.customerName) o.customerName = updates.customerName;
      if (updates.date) o.date = updates.date;
      if (updates.lines) o.lines = updates.lines;
    } else {
      const patch: Record<string, unknown> = {};
      if (updates.customerName) patch.customer_name = updates.customerName;
      if (updates.date) patch.date = updates.date;
      if (updates.lines) patch.lines = updates.lines;
      if (Object.keys(patch).length) {
        await getSupabaseAdmin().from("orders").update(patch).eq("id", id);
      }
    }
  },

  async verifyOrder(
    orderId: string,
    actor = "admin",
    opts: { companies?: CompanyKey[] } = {},
  ): Promise<Transaction | undefined> {
    const { companies } = opts;
    const toGenerate = companies && companies.length > 0 ? companies : CHAIN;

    if (isDemoMode) {
      const order = store.orders.find((o) => o.id === orderId);
      if (!order) return undefined;
      const txId = `TX-${Date.now().toString(36).toUpperCase()}`;
      const buildOpts = {
        transactionId: txId,
        orderId: order.id,
        marginRules: store.marginRules,
        companies: toGenerate,
        allocateInvoiceNo: (co: CompanyKey) => {
          store.counters[co] += 1;
          return formatInvoiceNo(co, store.counters[co]);
        },
      };
      const tx = buildCascade(order, buildOpts);
      order.status = "verified";
      store.transactions.unshift(tx);
      memLog(
        actor,
        "order.verified",
        `${order.id} -> ${tx.id}: ${tx.invoices.map((i) => `${i.company} ${i.invoiceNo}`).join(", ")}`,
      );
      return tx;
    }

    // ── Supabase path ──
    const db = getSupabaseAdmin();

    const { data: orderRow } = await db.from("orders").select("*").eq("id", orderId).single();
    if (!orderRow) return undefined;
    const order = rowToOrder(orderRow);

    const { data: marginRows } = await db.from("margin_rules").select("*");
    const marginRules: MarginRule[] = (marginRows ?? []).map((r) => ({
      productId: r.product_id,
      tier: r.tier as CompanyKey,
      type: r.type as "rm_per_unit" | "percent",
      value: Number(r.value),
    }));

    // Only increment counters for companies being generated.
    const counterMap: Record<string, number> = {};
    for (const co of toGenerate) {
      const { data: cRow } = await db
        .from("invoice_counters")
        .select("seq")
        .eq("company", co)
        .single();
      const newSeq = (cRow?.seq ?? 0) + 1;
      await db.from("invoice_counters").update({ seq: newSeq }).eq("company", co);
      counterMap[co] = newSeq;
    }

    const txId = `TX-${Date.now().toString(36).toUpperCase()}`;
    const tx = buildCascade(order, {
      transactionId: txId,
      orderId: order.id,
      marginRules,
      companies: toGenerate,
      allocateInvoiceNo: (co: CompanyKey) => formatInvoiceNo(co, counterMap[co]),
    });

    // save transaction
    await db.from("transactions").insert({
      id: tx.id,
      order_id: tx.orderId,
      customer_name: tx.customerName,
      date: tx.date,
      grand_total_sell: tx.grandTotalSell,
      margin_captured: tx.marginCaptured,
      created_at: tx.createdAt,
    });

    // save invoices
    for (const inv of tx.invoices) {
      await db.from("invoices").insert({
        id: inv.id,
        transaction_id: tx.id,
        company: inv.company,
        invoice_no: inv.invoiceNo,
        do_no: inv.doNo,
        your_ref: inv.yourRef,
        to_name: inv.toName,
        to_address_lines: inv.toAddressLines,
        to_tel: inv.toTel ?? null,
        to_fax: inv.toFax ?? null,
        terms: inv.terms,
        date: inv.date,
        lines: inv.lines,
        subtotal: inv.subtotal,
        rounding_adj: inv.roundingAdj,
        final_total: inv.finalTotal,
        amount_in_words: inv.amountInWords,
      });
    }

    // mark order verified
    await db.from("orders").update({ status: "verified" }).eq("id", orderId);

    await dbLog(
      actor,
      "order.verified",
      `${orderId} -> ${tx.id}: ${tx.invoices.map((i) => `${i.company} ${i.invoiceNo}`).join(", ")}`,
    );
    return tx;
  },

  async rejectOrder(orderId: string, actor = "admin"): Promise<void> {
    if (isDemoMode) {
      const o = store.orders.find((x) => x.id === orderId);
      if (o) {
        o.status = "rejected";
        memLog(actor, "order.rejected", orderId);
      }
    } else {
      await getSupabaseAdmin().from("orders").update({ status: "rejected" }).eq("id", orderId);
      await dbLog(actor, "order.rejected", orderId);
    }
  },

  // ── quotations (stored as orders with source="quotation") ───────────────────
  async nextQuoteNo(): Promise<string> {
    const d = new Date();
    const ym = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
    const prefix = `QT-${ym}-`;
    let count: number;
    if (isDemoMode) {
      count = store.orders.filter((o) => o.source === "quotation" && o.id.startsWith(prefix)).length;
    } else {
      const { data } = await getSupabaseAdmin()
        .from("orders")
        .select("id")
        .eq("source", "quotation")
        .like("id", `${prefix}%`);
      count = data?.length ?? 0;
    }
    return `${prefix}${String(count + 1).padStart(3, "0")}`;
  },

  async addQuotation(order: Order): Promise<void> {
    if (isDemoMode) {
      store.orders.unshift(order);
    } else {
      await getSupabaseAdmin().from("orders").insert(orderRow(order));
    }
    await log("admin", "quote.created", `${order.id} for ${order.customerName}`);
  },

  async listQuotations(): Promise<Order[]> {
    if (isDemoMode) {
      return store.orders.filter((o) => o.source === "quotation");
    }
    const { data } = await getSupabaseAdmin()
      .from("orders")
      .select("*")
      .eq("source", "quotation")
      .order("created_at", { ascending: false });
    return (data ?? []).map(rowToOrder);
  },

  async getQuotation(id: string): Promise<Order | undefined> {
    if (isDemoMode) return store.orders.find((o) => o.id === id && o.source === "quotation");
    const { data } = await getSupabaseAdmin().from("orders").select("*").eq("id", id).single();
    return data ? rowToOrder(data) : undefined;
  },

  // Accepting a quote spawns a fresh pending order (the normal cascade input)
  // and marks the quote "accepted" so it stays on record.
  async convertQuotationToOrder(id: string): Promise<string | undefined> {
    let quote: Order | undefined;
    if (isDemoMode) {
      quote = store.orders.find((o) => o.id === id && o.source === "quotation");
    } else {
      const { data } = await getSupabaseAdmin().from("orders").select("*").eq("id", id).single();
      quote = data ? rowToOrder(data) : undefined;
    }
    if (!quote) return undefined;

    const newId = `ord-${Date.now().toString(36)}`;
    const newOrder: Order = {
      ...quote,
      id: newId,
      source: "manual",
      status: "pending",
      rawMessage: `Converted from quotation ${id}`,
      parseConfidence: undefined,
      parseNotes: undefined,
      createdAt: new Date().toISOString(),
    };

    if (isDemoMode) {
      store.orders.unshift(newOrder);
      const q = store.orders.find((o) => o.id === id);
      if (q) q.status = "accepted";
    } else {
      const db = getSupabaseAdmin();
      await db.from("orders").insert(orderRow(newOrder));
      await db.from("orders").update({ status: "accepted" }).eq("id", id);
    }
    await log("admin", "quote.accepted", `${id} -> order ${newId}`);
    return newId;
  },

  // ── transactions ──────────────────────────────────────────────────────────
  async recentTransactions(n = 10): Promise<Transaction[]> {
    if (isDemoMode) return store.transactions.slice(0, n);
    const db = getSupabaseAdmin();
    const { data: rows } = await db
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(n);
    return Promise.all((rows ?? []).map((r) => fetchTransactionWithInvoices(r)));
  },

  async allTransactions(): Promise<Transaction[]> {
    if (isDemoMode) return store.transactions;
    const db = getSupabaseAdmin();
    const { data: rows } = await db
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });
    return Promise.all((rows ?? []).map((r) => fetchTransactionWithInvoices(r)));
  },

  async getTransaction(id: string): Promise<Transaction | undefined> {
    if (isDemoMode) return store.transactions.find((t) => t.id === id);
    const db = getSupabaseAdmin();
    const { data: row } = await db.from("transactions").select("*").eq("id", id).single();
    if (!row) return undefined;
    return fetchTransactionWithInvoices(row);
  },

  async getInvoice(
    invoiceId: string,
  ): Promise<{ invoice: Invoice; transaction: Transaction } | undefined> {
    if (isDemoMode) {
      for (const t of store.transactions) {
        const inv = t.invoices.find((i) => i.id === invoiceId);
        if (inv) return { invoice: inv, transaction: t };
      }
      return undefined;
    }
    const db = getSupabaseAdmin();
    const { data: invRow } = await db.from("invoices").select("*").eq("id", invoiceId).single();
    if (!invRow) return undefined;
    const { data: txRow } = await db
      .from("transactions")
      .select("*")
      .eq("id", invRow.transaction_id)
      .single();
    if (!txRow) return undefined;
    const tx = await fetchTransactionWithInvoices(txRow);
    const invoice = tx.invoices.find((i) => i.id === invoiceId)!;
    return { invoice, transaction: tx };
  },

  async voidTransaction(id: string, reason: string, actor = "admin"): Promise<void> {
    const r = (reason || "").trim() || "No reason given";
    if (isDemoMode) {
      const t = store.transactions.find((x) => x.id === id);
      if (!t) return;
      t.status = "void";
      t.voidReason = r;
      t.voidedAt = new Date().toISOString();
      memLog(actor, "transaction.void", `${id}: ${r}`);
      return;
    }
    await getSupabaseAdmin()
      .from("transactions")
      .update({ status: "void", void_reason: r, voided_at: new Date().toISOString() })
      .eq("id", id);
    await dbLog(actor, "transaction.void", `${id}: ${r}`);
  },

  // ── customer master ─────────────────────────────────────────────────────────
  async upsertCustomer(c: Customer): Promise<Customer> {
    const id = c.id || `cus-${Date.now().toString(36)}`;
    const rec = { ...c, id };
    if (isDemoMode) {
      const i = store.customers.findIndex((x) => x.id === id);
      if (i >= 0) store.customers[i] = rec;
      else store.customers.push(rec);
    } else {
      await getSupabaseAdmin().from("customers").upsert({
        id: rec.id,
        name: rec.name,
        address_lines: rec.addressLines,
        tel: rec.tel ?? null,
        fax: rec.fax ?? null,
      });
    }
    await log("admin", "customer.upsert", `${rec.name}`);
    return rec;
  },

  async deleteCustomer(id: string): Promise<void> {
    if (isDemoMode) {
      store.customers = store.customers.filter((x) => x.id !== id);
    } else {
      await getSupabaseAdmin().from("customers").delete().eq("id", id);
    }
    await log("admin", "customer.delete", id);
  },

  // ── product master ──────────────────────────────────────────────────────────
  async upsertProduct(p: Product): Promise<Product> {
    const id = p.id || `prd-${Date.now().toString(36)}`;
    const rec = { ...p, id };
    if (isDemoMode) {
      const i = store.products.findIndex((x) => x.id === id);
      if (i >= 0) store.products[i] = rec;
      else store.products.push(rec);
    } else {
      await getSupabaseAdmin().from("products").upsert({
        id: rec.id,
        name: rec.name,
        spec_lines: rec.specLines,
        uom: rec.uom,
      });
    }
    await log("admin", "product.upsert", `${rec.name}`);
    return rec;
  },

  async deleteProduct(id: string): Promise<void> {
    if (isDemoMode) {
      store.products = store.products.filter((x) => x.id !== id);
      store.marginRules = store.marginRules.filter((r) => r.productId !== id);
    } else {
      const db = getSupabaseAdmin();
      await db.from("margin_rules").delete().eq("product_id", id);
      await db.from("products").delete().eq("id", id);
    }
    await log("admin", "product.delete", id);
  },

  // ── search & analytics ────────────────────────────────────────────────────
  async search(q: string): Promise<Transaction[]> {
    if (!q.trim()) return [];
    if (isDemoMode) {
      const needle = q.trim().toLowerCase();
      return store.transactions.filter((t) => {
        if (t.customerName.toLowerCase().includes(needle)) return true;
        if (t.id.toLowerCase().includes(needle)) return true;
        return t.invoices.some(
          (i) =>
            i.invoiceNo.toLowerCase().includes(needle) ||
            i.lines.some((l) => l.description.toLowerCase().includes(needle)),
        );
      });
    }
    const db = getSupabaseAdmin();
    // search by customer name or tx id (Postgres ilike)
    const { data: txRows } = await db
      .from("transactions")
      .select("*")
      .or(`customer_name.ilike.%${q}%,id.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(50);
    // also search invoice numbers
    const { data: invRows } = await db
      .from("invoices")
      .select("transaction_id")
      .ilike("invoice_no", `%${q}%`);
    const extraIds = (invRows ?? []).map((r: { transaction_id: string }) => r.transaction_id);
    const allIds = [
      ...new Set([...(txRows ?? []).map((r: { id: string }) => r.id), ...extraIds]),
    ];
    if (!allIds.length) return [];
    const { data: allRows } = await db
      .from("transactions")
      .select("*")
      .in("id", allIds)
      .order("created_at", { ascending: false });
    return Promise.all((allRows ?? []).map((r) => fetchTransactionWithInvoices(r)));
  },

  async kpis(): Promise<{
    pending: number;
    transactions: number;
    totalSell: number;
    marginCaptured: number;
  }> {
    if (isDemoMode) {
      const txs = store.transactions.filter((t) => t.status !== "void");
      return {
        pending: store.orders.filter((o) => o.status === "pending").length,
        transactions: txs.length,
        totalSell: txs.reduce((s, t) => s + t.grandTotalSell, 0),
        marginCaptured: txs.reduce((s, t) => s + t.marginCaptured, 0),
      };
    }
    const db = getSupabaseAdmin();
    // select("*") tolerates the status column being absent before migration 001
    // runs; we filter void in JS so a missing column never errors the dashboard.
    const [{ count: pendingCount }, { data: agg }] = await Promise.all([
      db.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending"),
      db.from("transactions").select("*"),
    ]);
    const txs = (agg ?? []).filter((t: { status?: string }) => (t.status ?? "active") !== "void");
    return {
      pending: pendingCount ?? 0,
      transactions: txs.length,
      totalSell: txs.reduce((s: number, t: { grand_total_sell: string }) => s + Number(t.grand_total_sell), 0),
      marginCaptured: txs.reduce((s: number, t: { margin_captured: string }) => s + Number(t.margin_captured), 0),
    };
  },

  async audit(n = 20): Promise<AuditEntry[]> {
    if (isDemoMode) return store.audit.slice(0, n);
    const { data } = await getSupabaseAdmin()
      .from("audit_log")
      .select("*")
      .order("at", { ascending: false })
      .limit(n);
    return (data ?? []).map((r) => ({
      id: String(r.id),
      at: r.at,
      actor: r.actor,
      action: r.action,
      detail: r.detail ?? "",
    }));
  },
};
