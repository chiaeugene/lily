"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmt2 } from "@/lib/money";
import { IconX } from "@/components/icons";

function today() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

interface Row { description: string; uom: string; qty: string; unitPrice: string }

export default function PoBuilder({
  quotationId,
  defaultYourRef,
}: {
  quotationId?: string;
  defaultYourRef?: string;
}) {
  const router = useRouter();
  const [supplierName, setSupplierName] = useState("");
  const [supplierTel, setSupplierTel] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [yourRef, setYourRef] = useState(defaultYourRef ?? "");
  const [date, setDate] = useState(today());
  const [deliveryDate, setDeliveryDate] = useState(today());
  const [terms, setTerms] = useState("C.O.D.");
  const [rows, setRows] = useState<Row[]>([{ description: "", uom: "KGS", qty: "", unitPrice: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() { setRows((rs) => [...rs, { description: "", uom: "KGS", qty: "", unitPrice: "" }]); }
  function removeRow(i: number) { setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs)); }

  const subtotal = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unitPrice) || 0), 0);

  async function save() {
    setError("");
    const lines = rows
      .filter((r) => r.description.trim() && Number(r.qty) > 0)
      .map((r) => ({
        description: r.description.trim(),
        uom: r.uom || "UNIT",
        qty: Number(r.qty),
        unitPrice: Number(r.unitPrice) || 0,
      }));
    if (!supplierName.trim()) return setError("Enter a supplier name.");
    if (!lines.length) return setError("Add at least one item with a quantity.");

    setBusy(true);
    const res = await fetch("/api/po", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        quotationId: quotationId || undefined,
        supplierName,
        supplierTel,
        supplierAddressLines: supplierAddress.split("\n").map((s) => s.trim()).filter(Boolean),
        yourRef,
        terms,
        date,
        deliveryDate,
        lines,
      }),
    });
    if (res.ok) {
      const { id } = await res.json();
      router.push(`/po/${id}`);
    } else {
      setBusy(false);
      setError("Could not save the purchase order. Please try again.");
    }
  }

  const inputCls = "w-full bg-white border border-line rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none";

  return (
    <div className="space-y-5">
      {quotationId && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[13px] px-3.5 py-2.5">
          Linked to quotation <span className="font-mono">{quotationId}</span> — confirming this PO will create the
          pending sell-order for that quote.
        </div>
      )}

      {/* Supplier */}
      <section className="bg-surface rounded-xl border border-line shadow-card p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-[14px] text-ink">Supplier</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] text-muted mb-1">Name</label>
            <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Supplier name" className={inputCls} />
          </div>
          <div>
            <label className="block text-[12px] text-muted mb-1">Tel</label>
            <input value={supplierTel} onChange={(e) => setSupplierTel(e.target.value)} placeholder="03 1234 5678" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[12px] text-muted mb-1">Address (one line each)</label>
            <textarea value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)} rows={2} className={inputCls} />
          </div>
        </div>
      </section>

      {/* Line items */}
      <section className="bg-surface rounded-xl border border-line shadow-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[14px] text-ink">Items</h2>
          <button onClick={addRow} className="text-[13px] font-medium text-primary hover:text-primary-hover">+ Add item</button>
        </div>
        <div className="space-y-3">
          {rows.map((r, i) => {
            const lineTotal = (Number(r.qty) || 0) * (Number(r.unitPrice) || 0);
            return (
              <div key={i} className="rounded-lg border border-line p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-[12px] text-muted mb-1">Description</label>
                  <input value={r.description} onChange={(e) => setRow(i, { description: e.target.value })} placeholder="e.g. FLEXOTON PMS 012U YELLOW" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[12px] text-muted mb-1">UOM</label>
                  <input value={r.uom} onChange={(e) => setRow(i, { uom: e.target.value })} className={inputCls} />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[12px] text-muted mb-1">Qty</label>
                  <input inputMode="decimal" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} placeholder="0" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[12px] text-muted mb-1">Unit RM</label>
                  <input inputMode="decimal" value={r.unitPrice} onChange={(e) => setRow(i, { unitPrice: e.target.value })} placeholder="0.00" className={inputCls} />
                </div>
                <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                  <span className="tnum text-sm font-medium text-ink">RM {fmt2(lineTotal)}</span>
                  <button onClick={() => removeRow(i)} aria-label="Remove item" className="text-slate-400 hover:text-loss p-1.5 rounded-lg hover:bg-slate-100">
                    <IconX size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-3 pt-1 border-t border-line">
          <span className="text-[13px] text-muted">Subtotal</span>
          <span className="tnum text-lg font-semibold text-ink">RM {fmt2(subtotal)}</span>
        </div>
      </section>

      {/* Meta + save */}
      <section className="bg-surface rounded-xl border border-line shadow-card p-4 sm:p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] text-muted mb-1">Your Ref</label>
            <input value={yourRef} onChange={(e) => setYourRef(e.target.value)} placeholder="Quote / PO reference" className={inputCls} />
          </div>
          <div>
            <label className="block text-[12px] text-muted mb-1">Terms</label>
            <input value={terms} onChange={(e) => setTerms(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[12px] text-muted mb-1">Date</label>
            <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="dd/mm/yyyy" className={inputCls} />
          </div>
          <div>
            <label className="block text-[12px] text-muted mb-1">Delivery date</label>
            <input value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} placeholder="dd/mm/yyyy" className={inputCls} />
          </div>
        </div>
        {error && <p className="text-[13px] text-loss">{error}</p>}
        <button
          onClick={save}
          disabled={busy}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save purchase order"}
        </button>
      </section>
    </div>
  );
}
