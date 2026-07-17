"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Payslip } from "@/lib/types";
import { fmt2 } from "@/lib/money";
import { IconPrinter } from "@/components/icons";

export default function PayslipRow({ payslip }: { payslip: Payslip }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
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

  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-2.5 px-3 text-[13px] font-medium text-ink">{payslip.employeeName}</td>
      <td className="py-2.5 px-3 text-[13px] text-right tnum">{fmt2(payslip.basicSalary)}</td>
      <td className="py-2.5 px-3 text-[13px] text-right tnum text-loss">
        -{fmt2(payslip.epfEmployee + payslip.socsoEmployee + payslip.eisEmployee + payslip.pcb + payslip.deductions)}
      </td>
      <td className="py-2.5 px-3 text-[13px] text-right tnum font-semibold">{fmt2(payslip.netPay)}</td>
      <td className="py-2.5 px-3 text-right">
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
            onClick={toggle}
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
  );
}
