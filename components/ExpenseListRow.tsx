"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Expense } from "@/lib/types";
import { fmt2 } from "@/lib/money";

const STATUS_CLS: Record<string, string> = {
  pending_verification: "bg-amber-50 text-amber-700 border-amber-200",
  verified: "bg-blue-50 text-blue-700 border-blue-200",
  rejected: "bg-slate-100 text-slate-500 border-slate-200",
};

function todayDDMMYYYY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function ExpenseListRow({ expense }: { expense: Expense }) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ amount: String(expense.amount), paidDate: todayDDMMYYYY(), method: "Bank Transfer", reference: "" });

  async function pay() {
    setBusy(true);
    try {
      const res = await fetch(`/api/expenses/${expense.id}/voucher`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) || 0 }),
      });
      if (!res.ok) throw new Error();
      setPaying(false);
      router.refresh();
    } catch {
      alert("Couldn't record this payment — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-line px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-ink">{expense.vendorName}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[expense.status]}`}>
              {expense.status === "pending_verification" ? "Pending" : expense.status === "verified" ? "Verified" : "Rejected"}
            </span>
            {expense.status === "verified" && (
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${expense.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                {expense.paymentStatus === "paid" ? "Paid" : "Unpaid"}
              </span>
            )}
          </div>
          <div className="text-[12px] text-faint mt-0.5">{expense.category} · {expense.date} · {expense.description}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="tnum font-semibold text-[14px] text-ink">RM {fmt2(expense.amount)}</div>
        </div>
        {expense.status === "verified" && expense.paymentStatus === "unpaid" && !paying && (
          <button onClick={() => setPaying(true)} className="shrink-0 text-[12px] font-medium bg-primary hover:bg-primary-hover text-white rounded-lg px-3 py-1.5">
            Record payment
          </button>
        )}
      </div>

      {paying && (
        <div className="mt-3 pt-3 border-t border-line grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          <label className="block">
            <span className="block text-[11px] uppercase tracking-wide text-faint mb-1">Amount</span>
            <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, "") })} className="w-full border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary" />
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase tracking-wide text-faint mb-1">Paid date</span>
            <input value={form.paidDate} onChange={(e) => setForm({ ...form, paidDate: e.target.value })} className="w-full border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary" />
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase tracking-wide text-faint mb-1">Method</span>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary">
              <option>Bank Transfer</option>
              <option>Cash</option>
              <option>Cheque</option>
              <option>Online Banking</option>
              <option>Credit Card</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase tracking-wide text-faint mb-1">Reference</span>
            <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="optional" className="w-full border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary" />
          </label>
          <div className="col-span-2 sm:col-span-4 flex gap-2 justify-end">
            <button onClick={() => setPaying(false)} disabled={busy} className="text-[13px] text-muted hover:bg-canvas rounded-lg px-3 py-1.5">
              Cancel
            </button>
            <button onClick={pay} disabled={busy} className="text-[13px] font-semibold bg-primary hover:bg-primary-hover text-white rounded-lg px-3.5 py-1.5 disabled:opacity-60">
              {busy ? "Recording…" : "Record payment voucher"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
