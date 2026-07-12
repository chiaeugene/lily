import Link from "next/link";
import { repo } from "@/lib/repo";
import { PageHeader, KpiCard, Card } from "@/components/ui";
import DashboardHero from "@/components/DashboardHero";
import PendingList from "@/components/PendingList";
import TransactionsList from "@/components/TransactionsList";
import { IconArrowRight, IconClock, IconArchive, IconChart, IconTrendUp } from "@/components/icons";

export default async function Dashboard() {
  const [k, pending, recent] = await Promise.all([
    repo.kpis(),
    repo.listPendingOrders(),
    repo.recentTransactions(10),
  ]);

  // Only show a month-over-month delta when there's real prior-month data to
  // compare against — never fabricate a trend.
  const salesDeltaPct = k.salesLastMonth > 0 ? ((k.salesThisMonth - k.salesLastMonth) / k.salesLastMonth) * 100 : undefined;

  return (
    <>
      <PageHeader title="Dashboard" sub="Tien Ngai Machinery → Prim Paper → 3C Industries → customer" />
      <div className="p-4 md:p-8 space-y-5 max-w-[1200px] w-full">
        <DashboardHero pending={k.pending} marginThisMonth={k.marginThisMonth} />

        {/* 1 col (mobile) · 2 cols (tablet) · 4 cols (desktop) — always balanced */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label="Pending" value={String(k.pending)} tone={k.pending ? "loss" : "ink"} hint="awaiting verification" icon={<IconClock size={15} />} />
          <KpiCard label="Transactions" value={String(k.transactions)} tone="primary" hint="generated cascades" icon={<IconArchive size={15} />} />
          <KpiCard label="Total sales" value={k.totalSell} prefix="RM " tone="ink" deltaPct={salesDeltaPct} hint={salesDeltaPct === undefined ? "3C → customers" : undefined} icon={<IconChart size={15} />} />
          <KpiCard label="Group margin" value={k.marginCaptured} prefix="RM " tone="profit" hint="captured across tiers" icon={<IconTrendUp size={15} />} />
        </div>

        {pending.length > 0 && (
          <Card title={`Pending verification · ${pending.length}`} id="pending">
            <PendingList orders={pending} />
          </Card>
        )}

        <Card
          title="Recent transactions"
          action={
            <Link href="/records" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-hover">
              View all <IconArrowRight size={15} />
            </Link>
          }
        >
          <TransactionsList transactions={recent} />
        </Card>
      </div>
    </>
  );
}
