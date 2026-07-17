import Link from "next/link";
import { listPayrollRuns, listEmployees } from "@/lib/payroll";
import { PageHeader, Card } from "@/components/ui";
import { fmt2 } from "@/lib/money";
import { IconUsers, IconArrowRight } from "@/components/icons";
import RunPayrollButton from "@/components/RunPayrollButton";

export const dynamic = "force-dynamic";

function runTotal(payslips: { netPay: number }[]) {
  return payslips.reduce((s, p) => s + p.netPay, 0);
}

export default async function PayrollPage() {
  const [runs, employees] = await Promise.all([listPayrollRuns(), listEmployees()]);
  const hasEmployees = employees.some((e) => e.active);

  return (
    <>
      <PageHeader
        title="Payroll"
        sub="Calculates pay and generates payslips — never moves money"
        action={<RunPayrollButton hasEmployees={hasEmployees} />}
      />
      <div className="p-4 md:p-8 max-w-[1200px] w-full mx-auto">
        <Card pad={false}>
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 gap-3 px-4">
              <span className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <IconUsers size={22} />
              </span>
              <p className="text-[14px] font-medium text-ink">No payroll runs yet</p>
              <p className="text-[13px] text-muted max-w-xs">
                Add employees in Settings, then run payroll for a month to generate payslips.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {runs.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/payroll/${r.id}`}
                    className="flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-slate-50 active:bg-slate-100"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[14px] text-ink">{r.month}</div>
                      <div className="text-[12px] text-muted">
                        {r.payslips.length} employee{r.payslips.length === 1 ? "" : "s"} ·{" "}
                        {r.payslips.filter((p) => p.paidStatus === "paid").length} paid
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="tnum font-semibold text-[14px] text-ink">RM {fmt2(runTotal(r.payslips))}</div>
                      <div className="text-[11px] text-faint">net pay</div>
                    </div>
                    <IconArrowRight size={16} className="text-slate-300 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
