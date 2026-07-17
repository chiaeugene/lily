import { notFound } from "next/navigation";
import { getPayrollRun } from "@/lib/payroll";
import { PageHeader, Card } from "@/components/ui";
import { fmt2 } from "@/lib/money";
import PayslipRow from "@/components/PayslipRow";

export const dynamic = "force-dynamic";

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getPayrollRun(id);
  if (!run) notFound();

  const totalNet = run.payslips.reduce((s, p) => s + p.netPay, 0);
  const totalEmployerCost =
    totalNet +
    run.payslips.reduce(
      (s, p) => s + p.epfEmployee + p.socsoEmployee + p.eisEmployee + p.pcb + p.deductions + p.epfEmployer + p.socsoEmployer + p.eisEmployer,
      0,
    );

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
