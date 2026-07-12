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
