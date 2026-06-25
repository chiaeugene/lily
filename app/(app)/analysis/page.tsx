import { repo } from "@/lib/repo";
import { PageHeader, Card, KpiCard } from "@/components/ui";
import { fmt2 } from "@/lib/money";

export default async function AnalysisPage() {
  const txs = await repo.allTransactions();

  // aggregate by product (across Tien Ngai sell lines) and by customer
  const byProduct = new Map<string, { qty: number; sell: number }>();
  const byCustomer = new Map<string, { sell: number; margin: number; count: number }>();
  let totalSell = 0;
  let totalMargin = 0;

  for (const t of txs) {
    totalSell += t.grandTotalSell;
    totalMargin += t.marginCaptured;
    const c = byCustomer.get(t.customerName) ?? { sell: 0, margin: 0, count: 0 };
    c.sell += t.grandTotalSell;
    c.margin += t.marginCaptured;
    c.count += 1;
    byCustomer.set(t.customerName, c);
    const tn = t.invoices.find((i) => i.company === "tien_ngai");
    tn?.lines.forEach((l) => {
      const p = byProduct.get(l.description) ?? { qty: 0, sell: 0 };
      p.qty += l.qty;
      p.sell += l.total;
      byProduct.set(l.description, p);
    });
  }

  const maxSell = Math.max(1, ...[...byProduct.values()].map((p) => p.sell));

  return (
    <>
      <PageHeader title="Sales Analysis" sub="Volume, revenue and the margin earned at each tier" />
      <div className="p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Transactions" value={String(txs.length)} tone="primary" />
          <KpiCard label="Total sales" value={totalSell} prefix="RM " />
          <KpiCard label="Group margin" value={totalMargin} prefix="RM " tone="profit" />
          <KpiCard
            label="Avg margin %"
            value={totalSell ? `${((totalMargin / totalSell) * 100).toFixed(1)}%` : "—"}
            tone="profit"
          />
        </div>

        <Card title="Revenue by product">
          {byProduct.size === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {[...byProduct.entries()].map(([name, p]) => (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{name}</span>
                    <span className="tnum text-slate-500">
                      {p.qty} units · RM {fmt2(p.sell)}
                    </span>
                  </div>
                  <div className="h-2.5 bg-canvas rounded">
                    <div className="h-2.5 bg-primary rounded" style={{ width: `${(p.sell / maxSell) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="By customer">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-line">
                <th className="font-normal py-2">Customer</th>
                <th className="font-normal py-2 text-right">Orders</th>
                <th className="font-normal py-2 text-right">Sales (RM)</th>
                <th className="font-normal py-2 text-right">Margin (RM)</th>
              </tr>
            </thead>
            <tbody>
              {[...byCustomer.entries()].map(([name, c]) => (
                <tr key={name} className="border-b border-line/70">
                  <td className="py-2">{name}</td>
                  <td className="text-right tnum">{c.count}</td>
                  <td className="text-right tnum">{fmt2(c.sell)}</td>
                  <td className="text-right tnum text-profit">{fmt2(c.margin)}</td>
                </tr>
              ))}
              {byCustomer.size === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-slate-400 py-4">
                    No data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
