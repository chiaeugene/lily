import { isDemoMode } from "./env";
import { scopedDb } from "./scopedDb";
import type { Expense, PaymentVoucher } from "./types";

function todayDDMMYYYY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Held on globalThis so edits persist across dev HMR reloads (same pattern as lib/staff.ts).
const g = globalThis as unknown as { __lilyExpenses?: Expense[]; __lilyVouchers?: PaymentVoucher[] };
const DEMO_EXPENSES: Expense[] = g.__lilyExpenses ?? (g.__lilyExpenses = []);
const DEMO_VOUCHERS: PaymentVoucher[] = g.__lilyVouchers ?? (g.__lilyVouchers = []);

async function nextExpenseId(): Promise<string> {
  const d = new Date();
  const ym = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `EX-${ym}-`;
  const all = await listExpenses();
  const count = all.filter((e) => e.id.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

async function nextVoucherId(): Promise<string> {
  const d = new Date();
  const ym = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `PV-${ym}-`;
  const all = await listPaymentVouchers();
  const count = all.filter((v) => v.id.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export async function listExpenses(): Promise<Expense[]> {
  if (isDemoMode) return [...DEMO_EXPENSES].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const { data } = await (await scopedDb()).from("expenses").select("*").order("created_at", { ascending: false });
  return (data ?? []).map(rowToExpense);
}

export async function getExpense(id: string): Promise<Expense | undefined> {
  if (isDemoMode) return DEMO_EXPENSES.find((e) => e.id === id);
  const { data } = await (await scopedDb()).from("expenses").select("*").eq("id", id).maybeSingle();
  return data ? rowToExpense(data) : undefined;
}

// Creates a new expense in "pending_verification" — from Telegram (AI-parsed)
// or manual entry. Never auto-verified; a human always reviews it first.
export async function addExpense(input: {
  source: "telegram" | "manual";
  rawMessage?: string;
  documentDataUrl?: string;
  vendorName: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  parseConfidence?: number;
  parseNotes?: string;
}): Promise<Expense> {
  const id = await nextExpenseId();
  const expense: Expense = {
    id,
    source: input.source,
    rawMessage: input.rawMessage,
    documentDataUrl: input.documentDataUrl,
    vendorName: input.vendorName,
    description: input.description,
    category: input.category,
    amount: input.amount,
    date: input.date || todayDDMMYYYY(),
    status: "pending_verification",
    paymentStatus: "unpaid",
    parseConfidence: input.parseConfidence,
    parseNotes: input.parseNotes,
    createdAt: new Date().toISOString(),
  };
  if (isDemoMode) {
    DEMO_EXPENSES.unshift(expense);
    return expense;
  }
  // Supabase reports write failures in the response rather than throwing, so
  // an unchecked insert silently no-ops and the caller reports success.
  const { error } = await (await scopedDb()).from("expenses").insert({
    id: expense.id,
    source: expense.source,
    raw_message: expense.rawMessage ?? null,
    document_data_url: expense.documentDataUrl ?? null,
    vendor_name: expense.vendorName,
    description: expense.description,
    category: expense.category,
    amount: expense.amount,
    date: expense.date,
    status: expense.status,
    payment_status: expense.paymentStatus,
    parse_confidence: expense.parseConfidence ?? null,
    parse_notes: expense.parseNotes ?? null,
    created_at: expense.createdAt,
  });
  if (error) throw new Error(`addExpense failed: ${error.message}`);
  return expense;
}

// Edits + verifies an expense in one step (the staff review screen lets you
// fix any AI-guessed field before confirming).
export async function verifyExpense(
  id: string,
  patch: { vendorName?: string; description?: string; category?: string; amount?: number; date?: string },
  actor: string,
): Promise<Expense | undefined> {
  if (isDemoMode) {
    const e = DEMO_EXPENSES.find((x) => x.id === id);
    if (!e) return undefined;
    Object.assign(e, patch, { status: "verified" as const, verifiedAt: new Date().toISOString(), verifiedBy: actor });
    return e;
  }
  const db = await scopedDb();
  const upsert: Record<string, unknown> = {
    status: "verified",
    verified_at: new Date().toISOString(),
    verified_by: actor,
  };
  if (patch.vendorName !== undefined) upsert.vendor_name = patch.vendorName;
  if (patch.description !== undefined) upsert.description = patch.description;
  if (patch.category !== undefined) upsert.category = patch.category;
  if (patch.amount !== undefined) upsert.amount = patch.amount;
  if (patch.date !== undefined) upsert.date = patch.date;
  await db.from("expenses").update(upsert).eq("id", id);
  return getExpense(id);
}

export async function rejectExpense(id: string, actor: string): Promise<void> {
  if (isDemoMode) {
    const e = DEMO_EXPENSES.find((x) => x.id === id);
    if (e) {
      e.status = "rejected";
      e.verifiedAt = new Date().toISOString();
      e.verifiedBy = actor;
    }
    return;
  }
  await (await scopedDb())
    .from("expenses")
    .update({ status: "rejected", verified_at: new Date().toISOString(), verified_by: actor })
    .eq("id", id);
}

// ── Payment vouchers ─────────────────────────────────────────────────────────

export async function addPaymentVoucher(input: {
  expenseId: string;
  amount: number;
  paidDate: string;
  method: string;
  reference?: string;
  createdBy: string;
}): Promise<PaymentVoucher | undefined> {
  const expense = await getExpense(input.expenseId);
  if (!expense || expense.status !== "verified") return undefined;

  const id = await nextVoucherId();
  const voucher: PaymentVoucher = {
    id,
    expenseId: input.expenseId,
    vendorName: expense.vendorName,
    amount: input.amount,
    paidDate: input.paidDate || todayDDMMYYYY(),
    method: input.method || "Bank Transfer",
    reference: input.reference,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };

  if (isDemoMode) {
    DEMO_VOUCHERS.unshift(voucher);
    expense.paymentStatus = "paid";
    return voucher;
  }

  const db = await scopedDb();
  await db.from("payment_vouchers").insert({
    id: voucher.id,
    expense_id: voucher.expenseId,
    vendor_name: voucher.vendorName,
    amount: voucher.amount,
    paid_date: voucher.paidDate,
    method: voucher.method,
    reference: voucher.reference ?? null,
    created_at: voucher.createdAt,
    created_by: voucher.createdBy,
  });
  await db.from("expenses").update({ payment_status: "paid" }).eq("id", input.expenseId);
  return voucher;
}

export async function listPaymentVouchers(): Promise<PaymentVoucher[]> {
  if (isDemoMode) return [...DEMO_VOUCHERS].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const { data } = await (await scopedDb()).from("payment_vouchers").select("*").order("created_at", { ascending: false });
  return (data ?? []).map(rowToVoucher);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToExpense(r: any): Expense {
  return {
    id: r.id,
    source: r.source,
    rawMessage: r.raw_message ?? undefined,
    documentDataUrl: r.document_data_url ?? undefined,
    vendorName: r.vendor_name,
    description: r.description,
    category: r.category,
    amount: Number(r.amount),
    date: r.date,
    status: r.status,
    paymentStatus: r.payment_status,
    parseConfidence: r.parse_confidence != null ? Number(r.parse_confidence) : undefined,
    parseNotes: r.parse_notes ?? undefined,
    createdAt: r.created_at,
    verifiedAt: r.verified_at ?? undefined,
    verifiedBy: r.verified_by ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToVoucher(r: any): PaymentVoucher {
  return {
    id: r.id,
    expenseId: r.expense_id,
    vendorName: r.vendor_name,
    amount: Number(r.amount),
    paidDate: r.paid_date,
    method: r.method,
    reference: r.reference ?? undefined,
    createdAt: r.created_at,
    createdBy: r.created_by,
  };
}
