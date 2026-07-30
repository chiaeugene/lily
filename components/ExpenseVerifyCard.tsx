"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Expense } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { fmt2 } from "@/lib/money";
import { toast } from "sonner";
import VerifyCardShell, { VerifyField } from "@/components/VerifyCardShell";

export default function ExpenseVerifyCard({ expense }: { expense: Expense }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "accept" | "reject">("");
  const [form, setForm] = useState({
    vendorName: expense.vendorName,
    description: expense.description,
    category: expense.category,
    amount: String(expense.amount),
    date: expense.date,
  });

  async function send(action: "verify" | "reject") {
    if (action === "reject" && !confirm(`Reject this expense from ${expense.vendorName}?`)) return;
    setBusy(action === "verify" ? "accept" : "reject");
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "verify"
            ? { action: "verify", ...form, amount: Number(form.amount) || 0 }
            : { action: "reject" },
        ),
      });
      if (!res.ok) throw new Error();
      toast.success(action === "verify" ? "Expense verified" : "Expense rejected");
      router.refresh();
    } catch {
      toast.error(`Couldn't ${action} this expense — please try again.`);
    } finally {
      setBusy("");
    }
  }

  return (
    <VerifyCardShell
      id={expense.id}
      source={expense.source}
      confidence={expense.parseConfidence}
      rawMessage={expense.rawMessage}
      notes={expense.parseNotes}
      thumbnailUrl={expense.documentDataUrl}
      accent="loss"
      headline={form.vendorName || "Unknown vendor"}
      amount={fmt2(Number(form.amount) || 0)}
      busy={busy}
      rejectLabel="Reject"
      acceptLabel="Verify"
      onReject={() => send("reject")}
      onAccept={() => send("verify")}
    >
      <VerifyField label="Vendor" v={form.vendorName} on={(v) => setForm({ ...form, vendorName: v })} />
      <VerifyField
        label="Amount (RM)"
        v={form.amount}
        on={(v) => setForm({ ...form, amount: v.replace(/[^0-9.]/g, "") })}
      />
      <VerifyField label="Description" wide v={form.description} on={(v) => setForm({ ...form, description: v })} />
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
      <VerifyField label="Date" v={form.date} on={(v) => setForm({ ...form, date: v })} />
    </VerifyCardShell>
  );
}
