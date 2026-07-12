"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Order, CompanyKey } from "@/lib/types";
import { ConfidencePill } from "@/components/ui";
import { IconChevron, IconCheck, IconX, IconSparkle } from "@/components/icons";
import { fmt2 } from "@/lib/money";

const CHAIN: CompanyKey[] = ["tien_ngai", "prim", "3c"];
const COMPANY_LABELS: Record<CompanyKey, string> = {
  tien_ngai: "Tien Ngai Machinery",
  prim: "Prim Paper Trading",
  "3c": "3C Industries",
};
function billsTo(company: CompanyKey, customerName: string, active: CompanyKey[]): string {
  const myIdx = active.indexOf(company);
  const next = active[myIdx + 1];
  return next ? COMPANY_LABELS[next] : customerName;
}

export default function PendingList({ orders }: { orders: Order[] }) {
  const [open, setOpen] = useState<Order | null>(null);

  if (orders.length === 0) {
    return <p className="text-center py-8 text-sm text-muted">Nothing waiting — all orders are verified.</p>;
  }

  return (
    <>
      <div className="divide-y divide-line">
        {orders.map((o) => {
          const summary = o.lines.map((l) => `${l.qty} ${l.uom} ${l.productName}`).join(", ");
          const total = o.lines.reduce((s, l) => s + l.qty * l.sellUnitPrice, 0);
          return (
            <button
              key={o.id}
              onClick={() => setOpen(o)}
              className="w-full flex items-center gap-3 py-3 first:pt-0 last:pb-0 text-left hover:bg-canvas -mx-2 px-2 rounded-lg"
            >
              <span className="grid place-items-center h-9 w-9 rounded-full bg-warn-soft text-warn shrink-0">
                <IconSparkle size={18} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-ink truncate">{o.customerName}</span>
                  <ConfidencePill value={o.parseConfidence ?? 0} />
                </div>
                <div className="text-[12px] text-muted truncate">{summary}</div>
              </div>
              <div className="ml-auto flex items-center gap-3 shrink-0">
                <span className="tnum text-sm font-medium">RM {fmt2(total)}</span>
                <span className="text-[12px] text-primary font-medium hidden sm:flex items-center gap-0.5">
                  Review <IconChevron size={14} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {open && <ReviewSheet order={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// dd/MM/yyyy  <->  yyyy-MM-dd (for <input type="date">)
function toInputDate(d: string): string {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
function fromInputDate(d: string): string {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function ReviewSheet({ order, onClose }: { order: Order; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "verify" | "reject">("");
  const [customerName, setCustomerName] = useState(order.customerName);
  const [date, setDate] = useState(order.date);
  const [terms, setTerms] = useState(order.terms);
  const [termsDays, setTermsDays] = useState(() => {
    const m = order.terms.match(/(\d+)\s*days?/i);
    return m ? Number(m[1]) : 0; // default 0 (due same day / C.O.D.) unless a number is stated
  });
  const [lines, setLines] = useState(order.lines);
  const [ackIssues, setAckIssues] = useState(false);
  const [yourRef, setYourRef] = useState("");
  // Manually-typed invoice number per company — leave blank to auto-generate
  // the next in sequence. Keyed by company so each ticked company can have
  // its own override.
  const [invoiceNoOverrides, setInvoiceNoOverrides] = useState<Partial<Record<CompanyKey, string>>>({});
  // Array (not Set) — order matters: sequence is whatever order the user ticks
  // the boxes in, first tick = top of this invoice's chain, last tick = bills
  // the customer directly.
  const [active, setActive] = useState<CompanyKey[]>(CHAIN);

  // Detection chips reflect what the parser originally filled in — frozen from
  // the initial order prop, not the live-edited state, so editing a field
  // doesn't retroactively make it look "detected".
  const customerDetected = !!order.customerName.trim() && !/^unknown customer$/i.test(order.customerName);
  const lineDetection = order.lines.map((l) => ({
    product: !l.productId.startsWith("adhoc-") && !/^unknown product$/i.test(l.productName),
    qty: l.qty > 0,
    price: l.sellUnitPrice > 0,
  }));

  function toggleCompany(company: CompanyKey) {
    setActive((prev) => {
      if (prev.includes(company)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter((c) => c !== company);
      }
      return [...prev, company]; // newly ticked goes to the end of the sequence
    });
  }

  function patch(i: number, p: Partial<(typeof lines)[number]>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  }

  // ── soft guard: surface anything that would make a junk invoice ──
  const issues: string[] = [];
  if (!customerName.trim() || /unknown/i.test(customerName)) issues.push("Customer name looks unrecognised");
  lines.forEach((l, i) => {
    const tag = lines.length > 1 ? ` (line ${i + 1})` : "";
    if (!l.productName.trim() || /unknown/i.test(l.productName)) issues.push(`Product not in catalog${tag}`);
    if (!(l.qty > 0)) issues.push(`Quantity must be greater than 0${tag}`);
    if (!(l.sellUnitPrice > 0)) issues.push(`Sell price must be greater than 0${tag}`);
  });
  const blocked = issues.length > 0 && !ackIssues;

  async function verify() {
    if (blocked) return;
    setBusy("verify");
    const companies = active; // tick order — first ticked is the top of the chain
    const res = await fetch(`/api/orders/${order.id}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerName, date, terms, termsDays, lines, companies, yourRef, invoiceNoOverrides }),
    });
    const data = await res.json();
    if (data.transactionId) {
      router.push(`/transaction/${data.transactionId}`);
      router.refresh(); // re-render the persistent layout so the sidebar badge updates
    } else {
      setBusy("");
      router.refresh();
    }
  }
  async function reject() {
    setBusy("reject");
    await fetch(`/api/orders/${order.id}/verify`, { method: "DELETE" });
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative bg-surface w-full max-w-lg max-h-[90vh] rounded-2xl shadow-pop flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 h-16 border-b border-line">
          <div>
            <h3 className="font-semibold text-ink">Review order</h3>
            <p className="text-[12px] text-muted">Confirm details, then generate the 3 invoices.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:bg-canvas rounded-lg p-2">
            <IconX size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {order.rawMessage && (
            <div className="rounded-lg bg-canvas border border-line p-3">
              <div className="text-[11px] uppercase tracking-wide text-faint mb-1">Original message</div>
              <p className="text-[13px] text-ink italic">“{order.rawMessage}”</p>
            </div>
          )}
          {order.parseNotes && (
            <div className="rounded-lg bg-warn-soft text-warn text-[13px] px-3 py-2">{order.parseNotes}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Field label="Customer" detected={customerDetected}>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:border-primary"
                />
              </Field>
            </div>
            <Field label="Invoice date">
              <input
                type="date"
                value={toInputDate(date)}
                onChange={(e) => setDate(fromInputDate(e.target.value) || date)}
                className="w-full border border-line rounded-lg px-3 py-2 text-sm tnum focus:border-primary"
              />
            </Field>
            <Field label="Terms">
              <input
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="C.O.D."
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:border-primary"
              />
            </Field>
            <Field label="Payment due (days from invoice date)">
              <input
                type="number"
                min={0}
                value={termsDays}
                onChange={(e) => setTermsDays(Math.max(0, Number(e.target.value)))}
                className="w-full border border-line rounded-lg px-3 py-2 text-sm tnum focus:border-primary"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Your Ref (customer PO no., optional)">
                <input
                  value={yourRef}
                  onChange={(e) => setYourRef(e.target.value)}
                  placeholder="e.g. PO-2607/014"
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:border-primary"
                />
              </Field>
            </div>
          </div>

          <div className="space-y-4">
            {lines.map((l, i) => {
              const det = lineDetection[i];
              return (
                <div key={i} className="rounded-lg border border-line p-3.5">
                  <div className="flex items-center gap-1.5">
                    <div className="text-sm font-medium text-ink">{l.productName}</div>
                    {det.product ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-px text-[10px] font-medium leading-none">
                        detected
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-px text-[10px] font-medium leading-none">
                        check this
                      </span>
                    )}
                  </div>
                  {l.specLines.length > 0 && (
                    <div className="text-[12px] text-faint mt-0.5">{l.specLines.join(" · ")}</div>
                  )}
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <Field label="Qty" detected={det.qty}>
                      <input
                        type="number"
                        value={l.qty}
                        onChange={(e) => patch(i, { qty: Number(e.target.value) })}
                        className="w-full border border-line rounded-lg px-2.5 py-1.5 text-sm tnum focus:border-primary"
                      />
                    </Field>
                    <Field label="UOM">
                      <div className="px-2.5 py-1.5 text-sm text-muted">{l.uom}</div>
                    </Field>
                    <Field label="Sell / unit" detected={det.price}>
                      <input
                        type="number"
                        step="0.01"
                        value={l.sellUnitPrice}
                        onChange={(e) => patch(i, { sellUnitPrice: Number(e.target.value) })}
                        className="w-full border border-line rounded-lg px-2.5 py-1.5 text-sm tnum focus:border-primary"
                      />
                    </Field>
                  </div>
                  <div className="mt-2 text-[12px] text-muted tnum">
                    Line total: RM {fmt2(l.qty * l.sellUnitPrice)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Invoice selector */}
          <div className="rounded-lg border border-line bg-canvas p-3.5">
            <p className="text-[11px] uppercase tracking-wide text-faint mb-2">Generate invoices for</p>
            <div className="space-y-2">
              {CHAIN.map((company) => {
                const seqNo = active.indexOf(company); // -1 if not selected
                const isSelected = seqNo !== -1;
                return (
                  <div key={company}>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCompany(company)}
                        className="accent-primary w-4 h-4 flex-shrink-0"
                      />
                      {/* Sequence badge — position in tick order, not fixed chain order */}
                      <span className={`flex-shrink-0 w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center
                        ${isSelected ? "bg-primary text-white" : "bg-line text-faint"}`}>
                        {isSelected ? seqNo + 1 : "·"}
                      </span>
                      <span className={`text-sm leading-tight ${isSelected ? "text-ink" : "text-muted line-through"}`}>
                        <span className="font-medium">{COMPANY_LABELS[company]}</span>
                        {isSelected && (
                          <span className="text-faint font-normal">
                            {" · bills "}{billsTo(company, customerName, active)}
                          </span>
                        )}
                      </span>
                      {isSelected && seqNo < active.length - 1 && (
                        <span className="ml-auto text-[11px] text-faint">cost back-calc'd</span>
                      )}
                    </label>
                    {isSelected && (
                      <div className="ml-[26px] mt-1.5">
                        <input
                          value={invoiceNoOverrides[company] ?? ""}
                          onChange={(e) =>
                            setInvoiceNoOverrides((prev) => {
                              const next = { ...prev };
                              if (e.target.value.trim()) next[company] = e.target.value;
                              else delete next[company];
                              return next;
                            })
                          }
                          placeholder={`${COMPANY_LABELS[company]} invoice no. — leave blank to auto-generate`}
                          className="w-full border border-line rounded-lg px-2.5 py-1.5 text-[12px] text-muted focus:border-primary focus:text-ink"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {issues.length > 0 && (
          <div className="mx-5 mb-1 rounded-lg border border-warn/40 bg-warn-soft px-3 py-2.5">
            <div className="text-[12px] font-semibold text-warn mb-1">Please double-check before generating:</div>
            <ul className="text-[12px] text-warn list-disc pl-4 space-y-0.5">
              {issues.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <label className="mt-2 flex items-center gap-2 text-[12px] text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={ackIssues}
                onChange={(e) => setAckIssues(e.target.checked)}
                className="rounded border-line"
              />
              I&apos;ve checked these — generate anyway
            </label>
          </div>
        )}

        <div className="border-t border-line p-4 flex gap-2">
          <button
            onClick={verify}
            disabled={!!busy || blocked}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconCheck size={17} />
            {busy === "verify"
              ? "Generating…"
              : active.length === CHAIN.length
                ? "Verify & Generate 3 Invoices"
                : `Verify & Generate ${active.length} Invoice${active.length > 1 ? "s" : ""}`}
          </button>
          <button
            onClick={reject}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-loss hover:bg-loss-soft rounded-lg px-3 py-2.5"
          >
            <IconX size={16} /> Reject
          </button>
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  detected,
  children,
}: {
  label: string;
  detected?: boolean; // true = jade "detected" chip, false = amber "check this" chip, undefined = no chip
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 mb-1">
        <span className="text-[11px] uppercase tracking-wide text-faint">{label}</span>
        {detected === true && (
          <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-px text-[10px] font-medium leading-none">
            detected
          </span>
        )}
        {detected === false && (
          <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-px text-[10px] font-medium leading-none">
            check this
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
