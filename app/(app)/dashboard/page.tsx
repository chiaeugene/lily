import Link from "next/link";
import { repo } from "@/lib/repo";
import { PageHeader, KpiCard, Card } from "@/components/ui";
import PendingList from "@/components/PendingList";
import TransactionsList from "@/components/TransactionsList";
import { IconArrowRight } from "@/components/icons";

export default async function Dashboard() {
  const [k, pending, recent] = await Promise.all([
    repo.kpis(),
    repo.listPendingOrders(),
    repo.recentTransactions(10),
  ]);

  return (
    <>
      <PageHeader title="Dashboard" sub="Tien Ngai Machinery → Prim Paper → 3C Industries → customer" />
      <div className="p-8 space-y-6 max-w-[1200px] w-full">
        {/* 1 col (mobile) · 2 cols (tablet) · 4 cols (desktop) — always balanced */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label="Pending" value={String(k.pending)} tone={k.pending ? "loss" : "ink"} hint="awaiting verification" />
          <KpiCard label="Transactions" value={String(k.transactions)} tone="primary" hint="generated cascades" />
          <KpiCard label="Total sales" value={k.totalSell} prefix="RM " hint="3C → customers" />
          <KpiCard label="Group margin" value={k.marginCaptured} prefix="RM " tone="profit" hint="captured across tiers" />
        </div>

        {pending.length > 0 && (
          <Card title={`Pending verification · ${pending.length}`}>
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
