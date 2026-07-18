"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Payslip } from "@/lib/types";
import { fmt2 } from "@/lib/money";
import { IconPrinter, IconChevron } from "@/components/icons";

export default function PayslipRow({ payslip }: { payslip: Payslip }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    allowances: String(payslip.allowances),
    deductions: String(payslip.deductions),
    pcb: String(payslip.pcb),
  });

  const totalDeductions = payslip.epfEmployee + payslip.socsoEmployee + payslip.eisEmployee + payslip.pcb + payslip.deductions;

  async function togglePaid() {
    setBusy(true);
    try {
      const res = await fetch(`/api/payslips/${payslip.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paid: payslip.paidStatus !== "paid" }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Couldn't update paid status — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/payslips/${payslip.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          allowances: Number(form.allowances) || 0,
          deductions: Number(form.deductions) || 0,
          pcb: Number(form.pcb) || 0,
        }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      router.refresh();
    } catch {
      alert("Couldn't save changes — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr className="border-b border-line last:border-0 cursor-pointer hover:bg-canvas" onClick={() => setOpen(!open)}>
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-1.5">
            <IconChevron size={13} className={`text-faint transition-transform ${open ? "rotate-90" : ""}`} />
            <span className="text-[13px] font-medium text-ink">{payslip.employeeName}</span>
          </div>
        </td>
        <td className="py-2.5 px-3 text-[13px] text-right tnum">{fmt2(payslip.basicSalary)}</td>
        <td className="py-2.5 px-3 text-[13px] text-right tnum text-loss">-{fmt2(totalDeductions)}</td>
        <td className="py-2.5 px-3 text-[13px] text-right tnum font-semibold">{fmt2(payslip.netPay)}</td>
        <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-2">
            <a
              href={`/api/payslips/${payslip.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-primary hover:text-primary-hover"
            >
              <IconPrinter size={14} /> Payslip
            </a>
            <button
              onClick={togglePaid}
              disabled={busy}
              className={`text-[12px] font-medium rounded-lg px-2.5 py-1 ${
                payslip.paidStatus === "paid"
                  ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                  : "text-muted border border-line hover:bg-canvas"
              } disabled:opacity-60`}
            >
              {busy ? "…" : payslip.paidStatus === "paid" ? "Paid" : "Mark paid"}
            </button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-line last:border-0 bg-canvas/50">
          <td colSpan={5} className="px-4 py-4">
            {!editing ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-[12px]">
                <Field label="Basic salary" value={payslip.basicSalary} />
                <Field label="Allowances" value={payslip.allowances} />
                <Field label="EPF (employee 11%)" value={payslip.epfEmployee} negative />
                <Field label="EPF (employer)" value={payslip.epfEmployer} muted />
                <Field label="SOCSO (employee)" value={payslip.socsoEmployee} negative />
                <Field label="SOCSO (employer)" value={payslip.socsoEmployer} muted />
                <Field label="EIS (employee)" value={payslip.eisEmployee} negative />
                <Field label="EIS (employer)" value={payslip.eisEmployer} muted />
                <Field label="PCB" value={payslip.pcb} negative />
                <Field label="Other deductions" value={payslip.deductions} negative />
                <div className="col-span-2 sm:col-span-4 pt-2 flex items-center justify-between border-t border-line">
                  <span className="font-semibold text-ink">Net pay</span>
                  <span className="font-semibold text-ink tnum">RM {fmt2(payslip.netPay)}</span>
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <button
                    onClick={() => setEditing(true)}
                    className="text-[12px] font-medium text-primary hover:text-primary-hover"
                  >
                    Edit allowances / PCB / deductions
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg">
                <NumField label="Allowances (RM)" v={form.allowances} on={(v) => setForm({ ...form, allowances: v })} />
                <NumField label="PCB (RM)" v={form.pcb} on={(v) => setForm({ ...form, pcb: v })} />
                <NumField label="Other deductions (RM)" v={form.deductions} on={(v) => setForm({ ...form, deductions: v })} />
                <p className="col-span-full text-[11px] text-faint">
                  Changing allowances recalculates EPF/SOCSO/EIS automatically. Basic salary is edited on the
                  employee record in Settings and applies from the next run.
                </p>
                <div className="col-span-full flex gap-2">
                  <button
                    onClick={() => {
                      setEditing(false);
                      setForm({ allowances: String(payslip.allowances), deductions: String(payslip.deductions), pcb: String(payslip.pcb) });
                    }}
                    disabled={busy}
                    className="text-[12px] text-muted hover:bg-canvas rounded-lg px-3 py-1.5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={busy}
                    className="text-[12px] font-semibold bg-primary hover:bg-primary-hover text-white rounded-lg px-3 py-1.5 disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function Field({ label, value, negative, muted }: { label: string; value: number; negative?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-faint">{label}</span>
      <span className={`tnum ${negative ? "text-loss" : muted ? "text-faint" : "text-ink"}`}>
        {negative && value > 0 ? "-" : ""}{fmt2(value)}
      </span>
    </div>
  );
}

function NumField({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-faint mb-1">{label}</span>
      <input
        value={v}
        onChange={(e) => on(e.target.value.replace(/[^0-9.]/g, ""))}
        inputMode="decimal"
        className="w-full border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary"
      />
    </label>
  );
}
