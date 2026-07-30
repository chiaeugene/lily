"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Order } from "@/lib/types";
import { fmt2 } from "@/lib/money";
import { toast } from "sonner";
import VerifyCardShell, { VerifyField } from "@/components/VerifyCardShell";

/**
 * Money-in twin of ExpenseVerifyCard. Same shell, same header, same footer —
 * only the fields differ (customer/terms/date + line items, instead of
 * vendor/category/amount).
 */
export default function OrderVerifyCard({ order }: { order: Order }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "accept" | "reject">("");
  const [customerName, setCustomerName] = useState(order.customerName);
  const [date, setDate] = useState(order.date);
  const [terms, setTerms] = useState(order.terms);
  const [lines, setLines] = useState(order.lines.map((l) => ({ ...l })));

  const total = lines.reduce((s, l) => s + l.qty * l.sellUnitPrice - (l.disc ?? 0), 0);

  function setLine(i: number, patch: Partial<(typeof lines)[number]>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function verify() {
    setBusy("accept");
    try {
      const res = await fetch(`/api/orders/${order.id}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerName, date, terms, lines }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.transactionId) throw new Error(data?.error || "");
      toast.success(`Invoiced — ${data.transactionId}`);
      router.push(`/transaction/${data.transactionId}`);
    } catch (e) {
      toast.error((e as Error)?.message || "Couldn't verify this order — please try again.");
      setBusy("");
    }
  }

  async function reject() {
    if (!confirm(`Reject this order from ${order.customerName}?`)) return;
    setBusy("reject");
    try {
      const res = await fetch(`/api/orders/${order.id}/verify`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Order rejected");
      router.refresh();
    } catch {
      toast.error("Couldn't reject this order — please try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <VerifyCardShell
      id={order.id}
      source={order.source === "telegram" ? "telegram" : "manual"}
      confidence={order.parseConfidence}
      rawMessage={order.rawMessage}
      notes={order.parseNotes}
      accent="profit"
      headline={customerName || "Unknown customer"}
      amount={fmt2(total)}
      busy={busy}
      rejectLabel="Reject"
      acceptLabel="Verify & invoice"
      onReject={reject}
      onAccept={verify}
    >
      <VerifyField label="Customer" v={customerName} on={setCustomerName} />
      <VerifyField label="Date" v={date} on={setDate} />
      <VerifyField label="Terms" v={terms} on={setTerms} />
      <VerifyField label="Total (RM)" v={fmt2(total)} readOnly />

      <div className="col-span-2 space-y-2 pt-0.5">
        <span className="block text-[11px] uppercase tracking-wide text-faint">Line items</span>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <input
              value={l.productName}
              onChange={(e) => setLine(i, { productName: e.target.value })}
              className="col-span-6 border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary"
            />
            <input
              value={String(l.qty)}
              onChange={(e) => setLine(i, { qty: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })}
              className="col-span-2 border border-line rounded-lg px-2 py-1.5 text-[13px] text-right tnum focus:border-primary"
            />
            <span className="col-span-1 text-[11px] text-faint truncate">{l.uom}</span>
            <input
              value={String(l.sellUnitPrice)}
              onChange={(e) => setLine(i, { sellUnitPrice: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })}
              className="col-span-3 border border-line rounded-lg px-2 py-1.5 text-[13px] text-right tnum focus:border-primary"
            />
          </div>
        ))}
      </div>
    </VerifyCardShell>
  );
}
