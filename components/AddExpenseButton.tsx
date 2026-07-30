"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EXPENSE_CATEGORIES } from "@/lib/types";

const BLANK = { vendorName: "", description: "", category: "Others" as string, amount: "", date: "" };

export default function AddExpenseButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount) || 0 }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setForm(BLANK);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Couldn't add expense");
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-[13px] font-medium px-3.5 py-2">
        <span className="text-base leading-none">+</span> Add expense
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} placeholder="Vendor" className="border border-line rounded-lg px-2.5 py-1.5 text-[13px] w-32" />
      <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="border border-line rounded-lg px-2.5 py-1.5 text-[13px] w-40" />
      <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border border-line rounded-lg px-2.5 py-1.5 text-[13px]">
        {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="RM" inputMode="decimal" className="border border-line rounded-lg px-2.5 py-1.5 text-[13px] w-20" />
      {error && <span className="text-[12px] text-loss">{error}</span>}
      <button onClick={() => { setOpen(false); setError(""); }} disabled={busy} className="text-[13px] text-muted hover:bg-canvas rounded-lg px-3 py-1.5">Cancel</button>
      <button onClick={add} disabled={busy || !form.vendorName.trim() || !form.description.trim()} className="text-[13px] font-semibold bg-primary hover:bg-primary-hover text-white rounded-lg px-3.5 py-1.5 disabled:opacity-60">
        {busy ? "Saving…" : "Add"}
      </button>
    </div>
  );
}
