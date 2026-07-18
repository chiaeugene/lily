import { notFound } from "next/navigation";
import { getPayrollRun } from "@/lib/payroll";
import { PageHeader, Card } from "@/components/ui";
import { fmt2 } from "@/lib/money";
import PayslipRow from "@/components/PayslipRow";
import type { Payslip } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getPayrollRun(id);
  if (!run) notFound();

  const totalNet = run.payslips.reduce((s, p) => s + p.netPay, 0);
  const sum = (f: (p: Payslip) => number) => run.payslips.reduce((s, p) => s + f(p), 0);
  const epfEmployee = sum((p) => p.epfEmployee);
  const epfEmployer = sum((p) => p.epfEmployer);
  const socsoEmployee = sum((p) => p.socsoEmployee);
  const socsoEmployer = sum((p) => p.socsoEmployer);
  const eisEmployee = sum((p) => p.eisEmployee);
  const eisEmployer = sum((p) => p.eisEmployer);
  const totalPcb = sum((p) => p.pcb);
  const totalEmployerCost = totalNet + epfEmployee + socsoEmployee + eisEmployee + totalPcb + sum((p) => p.deductions) + epfEmployer + socsoEmployer + eisEmployer;

  return (
    <>
      <PageHeader title={`Payroll — ${run.month}`} sub={`${run.payslips.length} payslip${run.payslips.length === 1 ? "" : "s"}`} />
      <div className="p-4 md:p-8 max-w-[1200px] w-full mx-auto space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card title="Total net pay">
            <div className="tnum text-xl font-semibold text-ink">RM {fmt2(totalNet)}</div>
          </Card>
          <Card title="Total employer cost">
            <div className="tnum text-xl font-semibold text-ink">RM {fmt2(totalEmployerCost)}</div>
            <div className="text-[11px] text-faint mt-0.5">incl. EPF/SOCSO/EIS employer share</div>
          </Card>
          <Card title="Paid">
            <div className="tnum text-xl font-semibold text-ink">
              {run.payslips.filter((p) => p.paidStatus === "paid").length} / {run.payslips.length}
            </div>
          </Card>
        </div>

        <Card title="Statutory contributions">
          <p className="text-[12px] text-muted -mt-1 mb-3">
            What to remit for {run.month} — KWSP (EPF), PERKESO (SOCSO/EIS), LHDN (PCB)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint border-b border-line">
                  <th className="py-1.5 pr-4 font-medium">Contribution</th>
                  <th className="py-1.5 px-3 font-medium text-right">Employee share</th>
                  <th className="py-1.5 px-3 font-medium text-right">Employer share</th>
                  <th className="py-1.5 pl-3 font-medium text-right">Total to remit</th>
                </tr>
              </thead>
              <tbody className="tnum">
                <tr className="border-b border-line">
                  <td className="py-2 pr-4 font-medium text-ink">EPF (KWSP)</td>
                  <td className="py-2 px-3 text-right">{fmt2(epfEmployee)}</td>
                  <td className="py-2 px-3 text-right">{fmt2(epfEmployer)}</td>
                  <td className="py-2 pl-3 text-right font-semibold">{fmt2(epfEmployee + epfEmployer)}</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 pr-4 font-medium text-ink">SOCSO (PERKESO)</td>
                  <td className="py-2 px-3 text-right">{fmt2(socsoEmployee)}</td>
                  <td className="py-2 px-3 text-right">{fmt2(socsoEmployer)}</td>
                  <td className="py-2 pl-3 text-right font-semibold">{fmt2(socsoEmployee + socsoEmployer)}</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-2 pr-4 font-medium text-ink">EIS (PERKESO)</td>
                  <td className="py-2 px-3 text-right">{fmt2(eisEmployee)}</td>
                  <td className="py-2 px-3 text-right">{fmt2(eisEmployer)}</td>
                  <td className="py-2 pl-3 text-right font-semibold">{fmt2(eisEmployee + eisEmployer)}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-ink">PCB (LHDN)</td>
                  <td className="py-2 px-3 text-right">{fmt2(totalPcb)}</td>
                  <td className="py-2 px-3 text-right text-faint">—</td>
                  <td className="py-2 pl-3 text-right font-semibold">{fmt2(totalPcb)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Payslips" pad={false}>
          {run.payslips.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">No active employees at the time this run was made.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-faint border-b border-line">
                    <th className="py-2 px-3 font-medium">Employee</th>
                    <th className="py-2 px-3 font-medium text-right">Basic</th>
                    <th className="py-2 px-3 font-medium text-right">Deductions</th>
                    <th className="py-2 px-3 font-medium text-right">Net pay</th>
                    <th className="py-2 px-3 font-medium text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {run.payslips.map((p) => (
                    <PayslipRow key={p.id} payslip={p} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="text-[11px] text-faint">
          EPF/SOCSO/EIS use standard flat-rate approximations, not the official tiered wage-band tables. PCB and
          other deductions default to RM0 — verify all figures against the official KWSP/PERKESO/LHDN tables (or
          your accountant) before treating this as final. Payroll here calculates and records pay — it does not
          transfer money.
        </p>
      </div>
    </>
  );
}
