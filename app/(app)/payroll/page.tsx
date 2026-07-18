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
  const activeEmployees = employees.filter((e) => e.active);
  const hasEmployees = activeEmployees.length > 0;
  const monthlyPayroll = activeEmployees.reduce((s, e) => s + e.basicSalary, 0);
  const latestRun = runs[0];

  return (
    <>
      <PageHeader
        title="Payroll"
        sub="Calculates pay and generates payslips — never moves money"
        action={<RunPayrollButton hasEmployees={hasEmployees} />}
      />
      <div className="p-4 md:p-8 max-w-[1200px] w-full mx-auto space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card title="Active employees">
            <div className="tnum text-xl font-semibold text-ink">{activeEmployees.length}</div>
            <Link href="/settings" className="text-[11px] text-primary hover:text-primary-hover">
              Manage in Settings
            </Link>
          </Card>
          <Card title="Monthly basic payroll">
            <div className="tnum text-xl font-semibold text-ink">RM {fmt2(monthlyPayroll)}</div>
            <div className="text-[11px] text-faint mt-0.5">before EPF/SOCSO/EIS/PCB</div>
          </Card>
          <Card title="Runs on file">
            <div className="tnum text-xl font-semibold text-ink">{runs.length}</div>
          </Card>
          <Card title="Latest run">
            <div className="tnum text-xl font-semibold text-ink">{latestRun ? latestRun.month : "—"}</div>
            <div className="text-[11px] text-faint mt-0.5">
              {latestRun ? `${latestRun.payslips.filter((p) => p.paidStatus === "paid").length}/${latestRun.payslips.length} paid` : "no runs yet"}
            </div>
          </Card>
        </div>

        <Card title="Payroll runs" pad={false}>
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 gap-3 px-4">
              <span className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <IconUsers size={22} />
              </span>
              <p className="text-[14px] font-medium text-ink">No payroll runs yet</p>
              <p className="text-[13px] text-muted max-w-xs">
                {hasEmployees
                  ? "Click “Run payroll” above and pick a month to generate payslips for everyone active."
                  : "Add employees in Settings, then run payroll for a month to generate payslips."}
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
