// Payment status / aging helpers. A transaction's due date is computed on the
// fly from its invoice date + termsDays — never stored, so it's always
// consistent even if termsDays is edited after the fact via a data fix.

import type { Transaction } from "./types";

export type PaymentState = "paid" | "unpaid" | "overdue";

/** Parse "dd/MM/yyyy" into a local Date at midnight. */
export function parseDMY(s: string): Date | undefined {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

/** The date payment is due: invoice date + termsDays (0 = due same day). */
export function dueDate(tx: Transaction): Date | undefined {
  const issued = parseDMY(tx.date);
  if (!issued) return undefined;
  const d = new Date(issued);
  d.setDate(d.getDate() + (tx.termsDays ?? 0));
  return d;
}

/** Days overdue as of `now` (0 if not due yet or already paid). */
export function daysOverdue(tx: Transaction, now = new Date()): number {
  if (tx.paidStatus === "paid") return 0;
  const due = dueDate(tx);
  if (!due) return 0;
  return Math.max(0, daysBetween(due, now));
}

export function paymentState(tx: Transaction, now = new Date()): PaymentState {
  if (tx.paidStatus === "paid") return "paid";
  return daysOverdue(tx, now) > 0 ? "overdue" : "unpaid";
}

/** Aging bucket label for an unpaid/overdue transaction. */
export function agingBucket(tx: Transaction, now = new Date()): string {
  const d = daysOverdue(tx, now);
  if (d <= 0) return "Not due";
  if (d <= 30) return "1–30 days";
  if (d <= 60) return "31–60 days";
  if (d <= 90) return "61–90 days";
  return "90+ days";
}

export const AGING_BUCKETS = ["Not due", "1–30 days", "31–60 days", "61–90 days", "90+ days"] as const;
