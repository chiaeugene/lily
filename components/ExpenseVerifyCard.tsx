"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Expense } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { toast } from "sonner";

export default function ExpenseVerifyCard({ expense }: { expense: Expense }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "verify" | "reject">("");
  const [form, setForm] = useState({
    vendorName: expense.vendorName,
    description: expense.description,
    category: expense.category,
    amount: String(expense.amount),
    date: expense.date,
  });

  async function verify() {
    setBusy("verify");
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "verify", ...form, amount: Number(form.amount) || 0 }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("Couldn't verify this expense — please try again.");
    } finally {
      setBusy("");
    }
  }

  async function reject() {
    if (!confirm(`Reject this expense from ${expense.vendorName}?`)) return;
    setBusy("reject");
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("Couldn't reject this expense — please try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="rounded-lg border border-line p-4 space-y-3">
      <div className="flex items-start gap-3">
        {expense.documentDataUrl && (
          <img src={expense.documentDataUrl} alt="Receipt" className="h-16 w-16 rounded-lg object-cover border border-line shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[12px] text-muted">{expense.id}</span>
            <span className="text-[11px] rounded-full border border-line px-2 py-0.5 text-muted">
              {expense.source === "telegram" ? "via Telegram" : "manual"}
            </span>
            {expense.parseConfidence !== undefined && (
              <span className="text-[11px] rounded-full border border-line px-2 py-0.5 text-muted">
                AI {Math.round(expense.parseConfidence * 100)}%
              </span>
            )}
          </div>
          {expense.rawMessage && <p className="text-[12px] text-faint mt-1 line-clamp-2">&ldquo;{expense.rawMessage}&rdquo;</p>}
          {expense.parseNotes && <p className="text-[12px] text-warn mt-1">⚠ {expense.parseNotes}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Vendor" v={form.vendorName} on={(v) => setForm({ ...form, vendorName: v })} />
        <Field label="Amount (RM)" v={form.amount} on={(v) => setForm({ ...form, amount: v.replace(/[^0-9.]/g, "") })} />
        <div className="col-span-2">
          <Field label="Description" v={form.description} on={(v) => setForm({ ...form, description: v })} />
        </div>
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wide text-faint mb-1">Category</span>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <Field label="Date (dd/MM/yyyy)" v={form.date} on={(v) => setForm({ ...form, date: v })} />
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={reject} disabled={!!busy} className="text-[13px] text-loss hover:bg-loss-soft rounded-lg px-3 py-1.5 disabled:opacity-60">
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
        <button onClick={verify} disabled={!!busy} className="text-[13px] font-semibold bg-primary hover:bg-primary-hover text-white rounded-lg px-3.5 py-1.5 disabled:opacity-60">
          {busy === "verify" ? "Verifying…" : "Verify"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-faint mb-1">{label}</span>
      <input value={v} onChange={(e) => on(e.target.value)} className="w-full border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary" />
    </label>
  );
}
