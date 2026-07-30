import Link from "next/link";
import { repo } from "@/lib/repo";
import { listExpenses } from "@/lib/expenses";
import { listPayrollRuns } from "@/lib/payroll";
import { getSession } from "@/lib/currentUser";
import { PageHeader, KpiCard, Card } from "@/components/ui";
import DashboardHero from "@/components/DashboardHero";
import TransactionsList from "@/components/TransactionsList";
import { paymentState, daysOverdue } from "@/lib/payment";
import { fmt2 } from "@/lib/money";
import {
  IconArrowRight,
  IconClock,
  IconChart,
  IconTrendUp,
  IconReceipt,
  IconQuote,
  IconBox,
  IconRoute,
} from "@/components/icons";

export const dynamic = "force-dynamic";

// Lily's job is to turn messages into documents, then documents into money.
// So the dashboard answers three questions in order:
//   1. What needs me right now?   (the action queue)
//   2. Is the money healthy?      (in, out, owed, profit)
//   3. What just happened?        (recent activity + shortcuts)
export default async function Dashboard() {
  const [k, pending, recent, expenses, payrollRuns, session] = await Promise.all([
    repo.kpis(),
    repo.listPendingOrders(),
    repo.recentTransactions(6),
    listExpenses(),
    listPayrollRuns(),
    getSession(),
  ]);

  const pendingExpenses = expenses.filter((e) => e.status === "pending_verification").length;
  const unpaidExpenses = expenses.filter((e) => e.status === "verified" && e.paymentStatus === "unpaid");
  const actionCount = pending.length + pendingExpenses;

  const all = await repo.allTransactions();
  const active = all.filter((t) => t.status !== "void");
  const overdue = active.filter((t) => paymentState(t) === "overdue");
  const overdueTotal = overdue.reduce((s, t) => s + t.grandTotalSell, 0);
  const worstOverdue = overdue.sort((a, b) => daysOverdue(b) - daysOverdue(a))[0];

  const paidPayslips = payrollRuns.flatMap((r) => r.payslips).filter((p) => p.paidStatus === "paid");
  const payrollCost = paidPayslips.reduce(
    (s, p) => s + p.basicSalary + p.allowances + p.epfEmployer + p.socsoEmployer + p.eisEmployer,
    0,
  );
  const paidExpenseTotal = expenses
    .filter((e) => e.status === "verified" && e.paymentStatus === "paid")
    .reduce((s, e) => s + e.amount, 0);
  const netProfit = k.marginCaptured - payrollCost - paidExpenseTotal;

  const salesDeltaPct =
    k.salesLastMonth > 0 ? ((k.salesThisMonth - k.salesLastMonth) / k.salesLastMonth) * 100 : undefined;

  return (
    <>
      <PageHeader title="Dashboard" sub={session?.tenant.name} />
      <div className="p-4 md:p-8 space-y-6 max-w-[1200px] w-full mx-auto">
        <DashboardHero pending={k.pending} marginThisMonth={k.marginThisMonth} tenantName={session?.tenant.name ?? ""} />

        {/* Quick actions sit directly under the hero so they're reachable
            without scrolling — starting work is the most common intent. */}
        <section>
          <h2 className="text-[13px] font-semibold text-muted mb-3">Start something</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <QuickAction href="/quotation/new" icon={<IconQuote size={17} />} label="New quotation" />
            <QuickAction href="/po/new" icon={<IconBox size={17} />} label="New purchase order" />
            <QuickAction href="/expenses" icon={<IconReceipt size={17} />} label="Log an expense" />
            <QuickAction href="/journey" icon={<IconRoute size={17} />} label="Track an order" />
          </div>
        </section>

        {/* ── 1. What needs me ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-[13px] font-semibold text-muted mb-3">Needs your attention</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Awaiting review"
              value={String(actionCount)}
              tone={actionCount ? "loss" : "profit"}
              hint={actionCount ? "orders + expenses to verify" : "all clear"}
              icon={<IconClock size={15} />}
              href="/pending"
            />
            <KpiCard
              label="Overdue invoices"
              value={overdueTotal}
              prefix="RM "
              tone={overdueTotal ? "loss" : "ink"}
              hint={
                worstOverdue
                  ? `oldest ${daysOverdue(worstOverdue)}d — ${worstOverdue.customerName}`
                  : "nothing overdue"
              }
              icon={<IconReceipt size={15} />}
              href="/records"
            />
            <KpiCard
              label="Bills to pay"
              value={unpaidExpenses.reduce((s, e) => s + e.amount, 0)}
              prefix="RM "
              tone={unpaidExpenses.length ? "loss" : "ink"}
              hint={unpaidExpenses.length ? `${unpaidExpenses.length} verified, unpaid` : "nothing outstanding"}
              icon={<IconReceipt size={15} />}
              href="/expenses"
            />
          </div>
        </section>

        {/* ── 2. Is the money healthy ───────────────────────────────────── */}
        <section>
          <h2 className="text-[13px] font-semibold text-muted mb-3">Money</h2>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Sales"
              value={k.totalSell}
              prefix="RM "
              deltaPct={salesDeltaPct}
              hint={salesDeltaPct === undefined ? "all time" : undefined}
              icon={<IconChart size={15} />}
              href="/analysis"
            />
            <KpiCard
              label="Gross margin"
              value={k.marginCaptured}
              prefix="RM "
              tone="profit"
              hint="captured across tiers"
              icon={<IconTrendUp size={15} />}
              href="/analysis"
            />
            <KpiCard
              label="Money out"
              value={payrollCost + paidExpenseTotal}
              prefix="RM "
              tone={payrollCost + paidExpenseTotal ? "loss" : "ink"}
              hint="payroll + paid expenses"
              icon={<IconReceipt size={15} />}
              href="/pnl"
            />
            <KpiCard
              label="Net profit"
              value={netProfit}
              prefix="RM "
              tone={netProfit >= 0 ? "profit" : "loss"}
              hint="after everything paid"
              icon={<IconTrendUp size={15} />}
              href="/pnl"
            />
          </div>
        </section>

        {/* ── 3. What just happened ─────────────────────────────────────── */}
        <section>
          <h2 className="text-[13px] font-semibold text-muted mb-3">Recent activity</h2>
          <Card
            action={
              <Link
                href="/records"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-hover"
              >
                View all <IconArrowRight size={15} />
              </Link>
            }
          >
            <TransactionsList transactions={recent} />
          </Card>
        </section>

      </div>
    </>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3.5 text-[13px] font-medium text-ink
        shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <span className="h-8 w-8 shrink-0 rounded-lg bg-primary-soft text-primary-hover grid place-items-center">
        {icon}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}
