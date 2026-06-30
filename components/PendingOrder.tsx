"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Order, CompanyKey } from "@/lib/types";

// Chain order — must match lib/companies.ts CHAIN
const CHAIN: CompanyKey[] = ["tien_ngai", "prim", "3c"];

const COMPANY_LABELS: Record<CompanyKey, string> = {
  tien_ngai: "Tien Ngai Machinery",
  prim: "Prim Paper Trading",
  "3c": "3C Industries",
};

// Who each company naturally bills (next in chain; 3C bills the customer)
function billsTo(company: CompanyKey, customerName: string): string {
  const idx = CHAIN.indexOf(company);
  if (idx === CHAIN.length - 1) return customerName;
  return COMPANY_LABELS[CHAIN[idx + 1]];
}

export default function PendingOrder({ order }: { order: Order }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "verify" | "reject">("");
  const [lines, setLines] = useState(order.lines);
  const [customerName, setCustomerName] = useState(order.customerName);
  // All 3 checked by default
  const [selected, setSelected] = useState<Set<CompanyKey>>(new Set(CHAIN));

  const conf = Math.round((order.parseConfidence ?? 0) * 100);
  const confTone = conf >= 85 ? "text-profit" : conf >= 60 ? "text-amber-600" : "text-loss";

  function toggle(company: CompanyKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(company)) {
        // keep at least one checked
        if (next.size > 1) next.delete(company);
      } else {
        next.add(company);
      }
      return next;
    });
  }

  async function verify() {
    setBusy("verify");
    const companies = CHAIN.filter((c) => selected.has(c));
    const res = await fetch(`/api/orders/${order.id}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerName, lines, companies }),
    });
    const data = await res.json();
    if (data.transactionId) router.push(`/transaction/${data.transactionId}`);
    else router.refresh();
  }

  async function reject() {
    setBusy("reject");
    await fetch(`/api/orders/${order.id}/verify`, { method: "DELETE" });
    router.refresh();
  }

  function patchLine(i: number, patch: Partial<(typeof lines)[number]>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const selectedCount = selected.size;
  const allSelected = selectedCount === CHAIN.length;

  return (
    <div className="border border-line rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="font-semibold text-ink border border-transparent hover:border-line focus:border-brand rounded px-1.5 py-0.5 -ml-1.5"
            />
            <span className={`text-xs font-medium ${confTone}`}>AI {conf}%</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            via {order.source} · {order.date}
          </div>
        </div>
      </div>

      {order.rawMessage && (
        <div className="mt-2 text-xs bg-slate-50 rounded px-3 py-2 text-slate-600 italic">
          "{order.rawMessage}"
        </div>
      )}
      {order.parseNotes && <div className="mt-1.5 text-xs text-amber-600">⚠ {order.parseNotes}</div>}

      <table className="w-full mt-3 text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400">
            <th className="font-normal py-1">Product</th>
            <th className="font-normal py-1 w-20">Qty</th>
            <th className="font-normal py-1 w-20">UOM</th>
            <th className="font-normal py-1 w-28">Sell / unit</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-t border-line">
              <td className="py-1.5">{l.productName}</td>
              <td>
                <input
                  type="number"
                  value={l.qty}
                  onChange={(e) => patchLine(i, { qty: Number(e.target.value) })}
                  className="w-16 border border-line rounded px-1.5 py-0.5 tnum"
                />
              </td>
              <td className="text-slate-500">{l.uom}</td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  value={l.sellUnitPrice}
                  onChange={(e) => patchLine(i, { sellUnitPrice: Number(e.target.value) })}
                  className="w-24 border border-line rounded px-1.5 py-0.5 tnum"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Invoice selector */}
      <div className="mt-4 border border-line rounded-lg p-3 bg-slate-50">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          Generate invoices for
        </p>
        <div className="space-y-1.5">
          {CHAIN.map((company, idx) => (
            <label key={company} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(company)}
                onChange={() => toggle(company)}
                className="accent-brand w-4 h-4 flex-shrink-0"
              />
              <span className={`text-sm ${selected.has(company) ? "text-ink" : "text-slate-400 line-through"}`}>
                <span className="font-medium">{COMPANY_LABELS[company]}</span>
                <span className="text-slate-400 font-normal">
                  {" "}→ bills{" "}
                  <span className={selected.has(company) ? "text-slate-600" : ""}>
                    {billsTo(company, customerName)}
                  </span>
                </span>
              </span>
              {idx < CHAIN.length - 1 && (
                <span className="text-xs text-slate-300 ml-auto">
                  {selected.has(company) ? "cost back-calc'd" : "skipped"}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={verify}
          disabled={!!busy}
          className="bg-profit text-white text-sm font-medium rounded-lg px-4 py-2 hover:brightness-95 disabled:opacity-50"
        >
          {busy === "verify"
            ? "Generating…"
            : allSelected
              ? "✓ Verify & Generate 3 Invoices"
              : `✓ Verify & Generate ${selectedCount} Invoice${selectedCount > 1 ? "s" : ""}`}
        </button>
        <button
          onClick={reject}
          disabled={!!busy}
          className="text-sm text-slate-500 rounded-lg px-3 py-2 hover:bg-slate-100"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
