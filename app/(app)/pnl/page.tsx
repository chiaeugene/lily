import { repo } from "@/lib/repo";
import { listExpenses } from "@/lib/expenses";
import { listPayrollRuns } from "@/lib/payroll";
import { PageHeader, Card, KpiCard } from "@/components/ui";
import { fmt2 } from "@/lib/money";
import { EXPENSE_CATEGORIES, isDirectCost } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfitAndLossPage() {
  const [txs, expenses, payrollRuns] = await Promise.all([
    repo.allTransactions(),
    listExpenses(),
    listPayrollRuns(),
  ]);

  const active = txs.filter((t) => t.status !== "void");
  const revenue = active.reduce((s, t) => s + t.grandTotalSell, 0);

  // A multi-invoice transaction means this tenant resells through a cascade:
  // its cost of sales is genuinely what it paid upstream, so margin is the
  // right basis. A single-company service business has no such spread — its
  // cost of sales is the direct expenses it actually incurred doing the work.
  const cascade = active.some((t) => t.invoices.length > 1);

  const paidExpenses = expenses.filter((e) => e.status === "verified" && e.paymentStatus === "paid");
  const directFromExpenses = paidExpenses.filter((e) => isDirectCost(e.category)).reduce((s, e) => s + e.amount, 0);
  const overheadFromExpenses = paidExpenses.filter((e) => !isDirectCost(e.category)).reduce((s, e) => s + e.amount, 0);

  const costOfSales = cascade ? revenue - active.reduce((s, t) => s + t.marginCaptured, 0) : directFromExpenses;
  const grossProfit = revenue - costOfSales;
  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : undefined;

  // Payroll counts only once actually paid, matching the expense rule.
  const paidPayslips = payrollRuns.flatMap((r) => r.payslips).filter((p) => p.paidStatus === "paid");
  const payrollCost = paidPayslips.reduce(
    (s, p) => s + p.basicSalary + p.allowances + p.epfEmployer + p.socsoEmployer + p.eisEmployer,
    0,
  );

  // In cascade mode the direct expenses aren't inside cost of sales, so they
  // still have to land somewhere — they sit with the other overheads.
  const otherOverheads = cascade ? overheadFromExpenses + directFromExpenses : overheadFromExpenses;
  const operatingExpenses = payrollCost + otherOverheads;
  const netProfit = grossProfit - operatingExpenses;
  const netMarginPct = revenue > 0 ? (netProfit / revenue) * 100 : undefined;

  const byCategory = EXPENSE_CATEGORIES.map((c) => ({
    category: c,
    direct: isDirectCost(c),
    amount: paidExpenses.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0),
  })).filter((r) => r.amount > 0);
  const maxCat = Math.max(1, ...byCategory.map((r) => r.amount));

  const pendingVerification = expenses.filter((e) => e.status === "pending_verification").length;
  const verifiedUnpaid = expenses.filter((e) => e.status === "verified" && e.paymentStatus === "unpaid").length;

  return (
    <>
      <PageHeader title="Profit &amp; Loss" sub="Revenue − cost of sales − operating expenses" />
      <div className="p-4 md:p-8 max-w-[1000px] w-full mx-auto space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Revenue" value={revenue} prefix="RM " tone="ink" hint="invoiced" />
          <KpiCard
            label="Gross profit"
            value={grossProfit}
            prefix="RM "
            tone={grossProfit >= 0 ? "profit" : "loss"}
            hint={grossMarginPct !== undefined ? `${grossMarginPct.toFixed(1)}% margin` : undefined}
          />
          <KpiCard
            label="Operating expenses"
            value={operatingExpenses}
            prefix="RM "
            tone={operatingExpenses ? "loss" : "ink"}
            hint="payroll + overheads"
          />
          <KpiCard
            label="Net profit"
            value={netProfit}
            prefix="RM "
            tone={netProfit >= 0 ? "profit" : "loss"}
            hint={netMarginPct !== undefined ? `${netMarginPct.toFixed(1)}% of revenue` : undefined}
          />
        </div>

        <Card title="Statement">
          <div className="text-[13px]">
            <Row label="Revenue" value={revenue} bold />
            <Row
              label="Cost of sales"
              value={-costOfSales}
              sub={cascade ? "paid to upstream companies in the cascade" : "direct costs: fuel, tolls, materials, vehicle repairs"}
            />
            <Row label="Gross profit" value={grossProfit} bold rule hint={grossMarginPct !== undefined ? `${grossMarginPct.toFixed(1)}% margin` : undefined} />

            <div className="pt-3 pb-1 text-[11px] uppercase tracking-wide text-faint">Operating expenses</div>
            <Row label="Payroll" value={-payrollCost} sub={`${paidPayslips.length} paid payslip${paidPayslips.length === 1 ? "" : "s"}`} />
            <Row label="Overheads" value={-otherOverheads} sub="rent, utilities, insurance, office, professional fees" />
            <Row label="Total operating expenses" value={-operatingExpenses} bold rule />

            <Row label="Net profit" value={netProfit} bold big rule />
          </div>
        </Card>

        <Card title="Paid expenses by category">
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">No paid expenses yet.</p>
          ) : (
            <div className="space-y-3">
              {byCategory.map((r) => (
                <div key={r.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>
                      {r.category}
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-faint">
                        {r.direct ? "direct" : "overhead"}
                      </span>
                    </span>
                    <span className="tnum font-medium">RM {fmt2(r.amount)}</span>
                  </div>
                  <div className="h-2.5 bg-canvas rounded">
                    <div
                      className={`h-2.5 rounded ${r.direct ? "bg-primary" : "bg-warn"}`}
                      style={{ width: `${(r.amount / maxCat) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {(pendingVerification > 0 || verifiedUnpaid > 0) && (
          <p className="text-[12px] text-faint">
            {pendingVerification > 0 && `${pendingVerification} expense${pendingVerification === 1 ? "" : "s"} awaiting verification. `}
            {verifiedUnpaid > 0 && `${verifiedUnpaid} verified but unpaid — not counted until a payment voucher is recorded.`}
          </p>
        )}

        <p className="text-[11px] text-faint">
          Revenue is recognised when invoiced; costs only once actually paid. Direct costs are those that rise and
          fall with the work done — separating them from overheads is what makes gross margin meaningful. Not a
          statutory financial statement; have your accountant confirm before filing.
        </p>
      </div>
    </>
  );
}

function Row({
  label, value, sub, bold, big, rule, hint,
}: {
  label: string; value: number; sub?: string; bold?: boolean; big?: boolean; rule?: boolean; hint?: string;
}) {
  const negative = value < 0;
  return (
    <div className={`flex items-center justify-between py-2.5 ${rule ? "border-t border-line" : ""}`}>
      <div>
        <div className={bold ? "font-semibold text-ink" : "text-ink"}>{label}</div>
        {sub && <div className="text-[11px] text-faint mt-0.5">{sub}</div>}
      </div>
      <div className="text-right">
        <div className={`tnum ${big ? "text-lg" : ""} ${bold ? "font-semibold" : ""} ${negative ? "text-loss" : value > 0 ? "text-profit" : "text-ink"}`}>
          {negative ? "−" : ""}RM {fmt2(Math.abs(value))}
        </div>
        {hint && <div className="text-[11px] text-faint">{hint}</div>}
      </div>
    </div>
  );
}
