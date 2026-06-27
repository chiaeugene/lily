"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product, Customer } from "@/lib/types";
import { fmt2 } from "@/lib/money";
import { IconX } from "@/components/icons";

function today() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

interface Row { productId: string; qty: string; price: string }

export default function QuoteBuilder({ products, customers }: { products: Product[]; customers: Customer[] }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerTel, setCustomerTel] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [date, setDate] = useState(today());
  const [terms, setTerms] = useState("C.O.D.");
  const [rows, setRows] = useState<Row[]>([{ productId: "", qty: "", price: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  function onPickCustomer(id: string) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerTel(c.tel ?? "");
      setCustomerAddress((c.addressLines ?? []).join("\n"));
    } else {
      setCustomerName("");
      setCustomerTel("");
      setCustomerAddress("");
    }
  }

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() { setRows((rs) => [...rs, { productId: "", qty: "", price: "" }]); }
  function removeRow(i: number) { setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs)); }

  const subtotal = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.price) || 0), 0);

  async function save() {
    setError("");
    const lines = rows
      .filter((r) => r.productId && Number(r.qty) > 0)
      .map((r) => {
        const p = byId[r.productId];
        return {
          productId: p.id,
          productName: p.name,
          specLines: p.specLines,
          uom: p.uom,
          qty: Number(r.qty),
          sellUnitPrice: Number(r.price) || 0,
        };
      });
    if (!customerName.trim()) return setError("Enter a customer name.");
    if (!lines.length) return setError("Add at least one product with a quantity.");

    setBusy(true);
    const res = await fetch("/api/quotation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerId: customerId || undefined,
        customerName,
        customerTel,
        customerAddressLines: customerAddress.split("\n").map((s) => s.trim()).filter(Boolean),
        terms,
        date,
        lines,
      }),
    });
    if (res.ok) {
      const { id } = await res.json();
      router.push(`/quotation/${id}`);
    } else {
      setBusy(false);
      setError("Could not save the quotation. Please try again.");
    }
  }

  const inputCls = "w-full bg-white border border-line rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none";

  return (
    <div className="space-y-5">
      {/* Customer */}
      <section className="bg-surface rounded-xl border border-line shadow-card p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-[14px] text-ink">Customer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] text-muted mb-1">Saved customer</label>
            <select value={customerId} onChange={(e) => onPickCustomer(e.target.value)} className={inputCls}>
              <option value="">— New customer —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] text-muted mb-1">Name</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" className={inputCls} />
          </div>
          <div>
            <label className="block text-[12px] text-muted mb-1">Tel</label>
            <input value={customerTel} onChange={(e) => setCustomerTel(e.target.value)} placeholder="012 345 6789" className={inputCls} />
          </div>
          <div>
            <label className="block text-[12px] text-muted mb-1">Address (one line each)</label>
            <textarea value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} rows={2} className={inputCls} />
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
            const p = byId[r.productId];
            const lineTotal = (Number(r.qty) || 0) * (Number(r.price) || 0);
            return (
              <div key={i} className="rounded-lg border border-line p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-6">
                  <label className="block text-[12px] text-muted mb-1">Product</label>
                  <select value={r.productId} onChange={(e) => setRow(i, { productId: e.target.value })} className={inputCls}>
                    <option value="">— Select product —</option>
                    {products.map((pp) => <option key={pp.id} value={pp.id}>{pp.name}</option>)}
                  </select>
                  {p && p.specLines.length > 0 && (
                    <div className="mt-1 text-[11px] text-muted">{p.specLines.join(" · ")} · {p.uom}</div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[12px] text-muted mb-1">Qty</label>
                  <input inputMode="decimal" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} placeholder="0" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[12px] text-muted mb-1">Unit RM</label>
                  <input inputMode="decimal" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} placeholder="0.00" className={inputCls} />
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
            <label className="block text-[12px] text-muted mb-1">Date</label>
            <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="dd/mm/yyyy" className={inputCls} />
          </div>
          <div>
            <label className="block text-[12px] text-muted mb-1">Terms</label>
            <input value={terms} onChange={(e) => setTerms(e.target.value)} className={inputCls} />
          </div>
        </div>
        {error && <p className="text-[13px] text-loss">{error}</p>}
        <button
          onClick={save}
          disabled={busy}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save quotation"}
        </button>
      </section>
    </div>
  );
}
