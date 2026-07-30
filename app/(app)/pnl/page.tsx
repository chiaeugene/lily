import { repo } from "@/lib/repo";
import { listExpenses } from "@/lib/expenses";
import { listPayrollRuns } from "@/lib/payroll";
import { PageHeader, Card, KpiCard } from "@/components/ui";
import { fmt2 } from "@/lib/money";
import { EXPENSE_CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfitAndLossPage() {
  const [txs, expenses, payrollRuns] = await Promise.all([
    repo.allTransactions(),
    listExpenses(),
    listPayrollRuns(),
  ]);

  const activeTx = txs.filter((t) => t.status !== "void");
  const revenue = activeTx.reduce((s, t) => s + t.grandTotalSell, 0);
  const grossProfit = activeTx.reduce((s, t) => s + t.marginCaptured, 0);
  const cogs = revenue - grossProfit;

  // Payroll counted as an expense only once actually paid — same "pay when
  // paid" rule as the manual expense pipeline, not just once verified/run.
  const paidPayslips = payrollRuns.flatMap((r) => r.payslips).filter((p) => p.paidStatus === "paid");
  const payrollCost = paidPayslips.reduce(
    (s, p) => s + p.basicSalary + p.allowances + p.epfEmployer + p.socsoEmployer + p.eisEmployer,
    0,
  );

  const paidExpenses = expenses.filter((e) => e.status === "verified" && e.paymentStatus === "paid");
  const expenseByCategory = new Map<string, number>(EXPENSE_CATEGORIES.map((c) => [c, 0]));
  for (const e of paidExpenses) {
    expenseByCategory.set(e.category, (expenseByCategory.get(e.category) ?? 0) + e.amount);
  }
  const totalOtherExpenses = paidExpenses.reduce((s, e) => s + e.amount, 0);

  const totalOperatingExpenses = payrollCost + totalOtherExpenses;
  const netProfit = grossProfit - totalOperatingExpenses;

  const pendingVerification = expenses.filter((e) => e.status === "pending_verification").length;
  const verifiedUnpaid = expenses.filter((e) => e.status === "verified" && e.paymentStatus === "unpaid").length;

  return (
    <>
      <PageHeader title="Profit &amp; Loss" sub="Revenue − COGS − Operating Expenses (payroll + paid expenses) = Net Profit" />
      <div className="p-4 md:p-8 max-w-[1000px] w-full mx-auto space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Revenue" value={revenue} prefix="RM " tone="ink" />
          <KpiCard label="Gross profit" value={grossProfit} prefix="RM " tone="profit" />
          <KpiCard label="Operating expenses" value={totalOperatingExpenses} prefix="RM " tone={totalOperatingExpenses ? "loss" : "ink"} />
          <KpiCard label="Net profit" value={netProfit} prefix="RM " tone={netProfit >= 0 ? "profit" : "loss"} />
        </div>

        <Card title="Statement">
          <div className="text-[13px] divide-y divide-line">
            <Row label="Revenue" value={revenue} />
            <Row label="Cost of goods sold" value={-cogs} sub="derived: revenue − group margin captured" />
            <Row label="Gross profit" value={grossProfit} bold />
            <Row label="Payroll (paid only)" value={-payrollCost} sub={`${paidPayslips.length} paid payslip${paidPayslips.length === 1 ? "" : "s"}`} />
            <Row label="Other expenses (paid only)" value={-totalOtherExpenses} sub={`${paidExpenses.length} paid expense${paidExpenses.length === 1 ? "" : "s"}`} />
            <Row label="Net profit" value={netProfit} bold big />
          </div>
        </Card>

        <Card title="Paid expenses by category">
          {totalOtherExpenses === 0 ? (
            <p className="text-sm text-muted py-4 text-center">No paid expenses yet.</p>
          ) : (
            <div className="space-y-3">
              {EXPENSE_CATEGORIES.map((c) => {
                const v = expenseByCategory.get(c) ?? 0;
                if (v === 0) return null;
                return (
                  <div key={c}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{c}</span>
                      <span className="tnum font-medium">RM {fmt2(v)}</span>
                    </div>
                    <div className="h-2.5 bg-canvas rounded">
                      <div className="h-2.5 bg-primary rounded" style={{ width: `${(v / totalOtherExpenses) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {(pendingVerification > 0 || verifiedUnpaid > 0) && (
          <p className="text-[12px] text-faint">
            {pendingVerification > 0 && `${pendingVerification} expense${pendingVerification === 1 ? "" : "s"} awaiting verification. `}
            {verifiedUnpaid > 0 && `${verifiedUnpaid} verified but unpaid — won't count here until a payment voucher is recorded.`}
            {" "}Not reflected in the numbers above.
          </p>
        )}

        <p className="text-[11px] text-faint">
          COGS is derived from the invoice cascade's group margin, not a separately tracked cost ledger. Payroll and
          expenses only count once actually paid, matching how the business recognizes cash cost. This is not a
          statutory-compliant financial statement — treat it as a working estimate and have your accountant confirm
          before filing.
        </p>
      </div>
    </>
  );
}

function Row({ label, value, sub, bold, big }: { label: string; value: number; sub?: string; bold?: boolean; big?: boolean }) {
  const negative = value < 0;
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <div className={bold ? "font-semibold text-ink" : "text-ink"}>{label}</div>
        {sub && <div className="text-[11px] text-faint mt-0.5">{sub}</div>}
      </div>
      <div className={`tnum ${big ? "text-lg" : ""} ${bold ? "font-semibold" : ""} ${negative ? "text-loss" : value > 0 ? "text-profit" : "text-ink"}`}>
        {negative ? "-" : ""}RM {fmt2(Math.abs(value))}
      </div>
    </div>
  );
}
