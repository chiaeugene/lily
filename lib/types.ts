// ── Core domain types for Lily ───────────────────────────────────────────────

/** A legal entity that issues invoices. */
export type CompanyKey = "prim" | "3c" | "tien_ngai";

export interface BankAccount {
  bank: string;
  account: string;
}

export interface Company {
  key: CompanyKey;
  name: string;
  regNo: string; // e.g. "202501032538 (1633949-T)"
  tinNo?: string;
  formerlyKnownAs?: string;
  addressLines: string[];
  tel: string;
  email: string;
  banks: BankAccount[];
  /** invoice-number style: "running" => INV-000123, "ym" => INV-2606/0004 */
  invoiceFormat: "running" | "ym";
  invoicePrefix: string; // "INV-" | "I-"
  // layout flags mapping the visual differences between the three skins
  showLogo: boolean;
  logoText?: string;
  showQr: boolean;
  qrInFooter?: boolean; // Tien Ngai prints its QR bottom-right (by the footer), not in the header
  /** A real bank-issued DuitNow/payment QR image (data URL), uploaded in Settings.
   *  Only rendered when set — no decorative fake QR is ever shown on a real invoice. */
  paymentQrDataUrl?: string;
  showLhdnLink: boolean;
  showRoundingRow: boolean;
  showAuthorisedSignature: boolean;
}

export interface Customer {
  id: string;
  name: string;
  addressLines: string[];
  tel?: string;
  fax?: string;
  /** Opaque random token for the customer's read-only self-service portal link. */
  portalToken?: string;
}

export interface Product {
  id: string;
  name: string; // "THERMAL PAPER 48GSM 225MM"
  specLines: string[]; // ["59.5KG-1ROLL", "58.5KG-1ROLL"] (defaults; per-order overridable)
  uom: string; // "KGS" | "BOXES"
}

export type MarginType = "rm_per_unit" | "percent";

/**
 * Per product, per company. `tier` is the company that TAKES this margin on its
 * own sale. Walking the chain from the customer-facing seller down to the origin,
 * each non-origin company's margin derives the price its supplier charges it.
 * The origin company (CHAIN[0]) has no margin rule — it issues at the derived base.
 */
export interface MarginRule {
  productId: string;
  /** Layer position from the customer end: 1 = customer-facing, 2 = middle, …
   *  Margins belong to the layer, not to any specific company. */
  layer: number;
  type: MarginType;
  value: number; // RM/unit, or percent markup-on-cost (e.g. 5 = 5%)
}

export interface OrderLine {
  productId: string;
  productName: string;
  specLines: string[];
  qty: number;
  uom: string;
  sellUnitPrice: number; // Tien Ngai -> customer, per unit
  disc?: number;
}

// pending/verified/rejected = order lifecycle; quote/accepted = quotation lifecycle
// (a quotation is stored as an order row with source="quotation").
export type OrderStatus = "pending" | "verified" | "rejected" | "quote" | "accepted";

export interface Order {
  id: string;
  source: "telegram" | "manual" | "quotation";
  rawMessage?: string;
  telegramUser?: string;
  customerId?: string;
  customerName: string;
  customerAddressLines: string[];
  customerTel?: string;
  terms: string; // "C.O.D."
  date: string; // dd/MM/yyyy
  lines: OrderLine[];
  status: OrderStatus;
  parseConfidence?: number; // 0..1 from the AI parser
  parseNotes?: string;
  createdAt: string;
  /** The quotation this order was converted/accepted from, if any (powers the journey view). */
  quotationId?: string;
}

// ── Generated invoices ────────────────────────────────────────────────────────

export interface InvoiceLine {
  item: number;
  description: string;
  specLines: string[];
  qty: number;
  uom: string;
  unitPrice: number;
  disc: number;
  total: number;
}

export interface Invoice {
  id: string;
  company: CompanyKey;
  invoiceNo: string;
  doNo: string;
  yourRef: string;
  // bill-to
  toName: string;
  toAddressLines: string[];
  toTel?: string;
  toFax?: string;
  terms: string;
  date: string;
  lines: InvoiceLine[];
  subtotal: number;
  roundingAdj: number;
  finalTotal: number;
  amountInWords: string;
  // MyInvois (LHDN e-Invoice) submission state
  myinvoisStatus?: "submitted" | "valid" | "invalid";
  myinvoisUid?: string;
  myinvoisLongId?: string;
  myinvoisSubmittedAt?: string;
}

export type TransactionStatus = "active" | "void";
export type PaidStatus = "unpaid" | "paid";

/** One order -> one Transaction holding the three cascade invoices. */
export interface Transaction {
  id: string;
  orderId: string;
  customerName: string;
  date: string;
  invoices: Invoice[]; // [prim, 3c, tien_ngai]
  grandTotalSell: number; // tien_ngai -> customer total
  marginCaptured: number; // sell total - prim cost total (group margin)
  createdAt: string;
  status?: TransactionStatus; // undefined treated as "active"
  voidReason?: string;
  voidedAt?: string;
  /** Days from invoice date until payment is due (0 = due same day / C.O.D.). */
  termsDays?: number;
  paidStatus?: PaidStatus; // undefined treated as "unpaid"
  paidAt?: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
}

// ── Purchase orders (Tien Ngai buying raw materials from a supplier) ─────────
// Separate from the sell-side Order/Invoice cascade: a PO has one supplier, no
// margin chain, and (optionally) links back to the quotation that prompted it.
// Confirming a linked PO spawns the pending sell-order for that quotation.

export interface PoLine {
  description: string;
  uom: string;
  qty: number;
  unitPrice: number;
  disc?: number;
}

export type PoStatus = "draft" | "confirmed" | "cancelled";

export interface PurchaseOrder {
  id: string; // "PO-2607-001"
  quotationId?: string; // the quotation this procurement is for, if any
  supplierName: string;
  supplierAddressLines: string[];
  supplierTel?: string;
  supplierFax?: string;
  yourRef?: string;
  terms: string;
  date: string; // dd/MM/yyyy
  deliveryDate?: string;
  lines: PoLine[];
  status: PoStatus;
  linkedOrderId?: string; // the pending sell-order spawned on confirm
  createdAt: string;
  confirmedAt?: string;
}

// ── Payroll ────────────────────────────────────────────────────────────────
// Calculates + records pay; never moves money. EPF/SOCSO/EIS use standard
// flat-rate approximations (see lib/payroll.ts) — verify against the official
// KWSP/PERKESO tables before relying on these for a real payroll run.

export interface Employee {
  id: string;
  name: string;
  icNo?: string;
  position?: string;
  bankName?: string;
  bankAccount?: string;
  epfNo?: string;
  socsoNo?: string;
  basicSalary: number;
  active: boolean;
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  epfEmployee: number;
  epfEmployer: number;
  socsoEmployee: number;
  socsoEmployer: number;
  eisEmployee: number;
  eisEmployer: number;
  pcb: number; // manual entry — not calculated
  netPay: number;
  paidStatus: PaidStatus;
  paidAt?: string;
}

export interface PayrollRun {
  id: string; // "PR-2607"
  month: string; // "2026-07"
  createdAt: string;
  payslips: Payslip[];
}

// ── Expenses & payment vouchers ──────────────────────────────────────────────
// Captured (often via Telegram, text or a receipt photo), verified by staff,
// then paid — only PAID expenses count as a P&L expense, matching how the
// business actually recognizes cost.

export const EXPENSE_CATEGORIES = [
  "Raw Materials",
  "Utilities",
  "Rental",
  "Transport & Logistics",
  "Office Supplies",
  "Repairs & Maintenance",
  "Professional Fees",
  "Marketing",
  "Others",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * Cost of sales vs overhead — the split a real P&L needs.
 *
 * Direct costs rise and fall with the work you actually do (fuel and tolls for
 * a delivery, materials consumed on a job). Overheads are what you pay whether
 * or not a single job happens this month (rent, insurance, office).
 *
 * Gross profit = revenue − direct costs, and it answers "does the work itself
 * make money?". Net profit then subtracts overheads. Lumping them together
 * hides whether a business is unprofitable because its jobs are underpriced or
 * because its fixed costs are too high.
 */
export const DIRECT_COST_CATEGORIES: readonly string[] = [
  "Raw Materials",
  "Transport & Logistics",
  "Repairs & Maintenance",
];

export function isDirectCost(category: string): boolean {
  return DIRECT_COST_CATEGORIES.includes(category);
}

export type ExpenseStatus = "pending_verification" | "verified" | "rejected";
export type ExpensePaymentStatus = "unpaid" | "paid";

export interface Expense {
  id: string; // "EX-2607-001"
  source: "telegram" | "manual";
  rawMessage?: string;
  documentDataUrl?: string; // receipt/photo, if one was sent
  vendorName: string;
  description: string;
  category: string;
  amount: number;
  date: string; // dd/MM/yyyy
  status: ExpenseStatus;
  paymentStatus: ExpensePaymentStatus;
  parseConfidence?: number; // 0..1 from the AI parser, telegram-sourced only
  parseNotes?: string;
  createdAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface PaymentVoucher {
  id: string; // "PV-2607-001"
  expenseId: string;
  vendorName: string;
  amount: number;
  paidDate: string; // dd/MM/yyyy
  method: string; // "Bank Transfer" | "Cash" | "Cheque" | "Online Banking"
  reference?: string;
  createdAt: string;
  createdBy: string;
}
