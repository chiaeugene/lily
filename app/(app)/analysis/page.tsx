import { repo } from "@/lib/repo";
import { PageHeader, Card, KpiCard } from "@/components/ui";
import { fmt2 } from "@/lib/money";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function AnalysisPage() {
  const all = await repo.allTransactions();
  const txs = all.filter((t) => t.status !== "void"); // void excluded from analytics

  const byProduct = new Map<string, { qty: number; sell: number }>();
  const byCustomer = new Map<string, { sell: number; margin: number; count: number }>();
  // month key "yyyy-MM" -> totals
  const byMonth = new Map<string, { label: string; sell: number; margin: number }>();
  // per-tier margin earned across the group
  const tierMargin = { prim: 0, "3c": 0 };
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

    // month bucket (date is dd/MM/yyyy)
    const m = t.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const key = `${m[3]}-${m[2]}`;
      const label = `${MONTHS[Number(m[2]) - 1]} ${m[3]}`;
      const mm = byMonth.get(key) ?? { label, sell: 0, margin: 0 };
      mm.sell += t.grandTotalSell;
      mm.margin += t.marginCaptured;
      byMonth.set(key, mm);
    }

    // per-tier margin: each company total minus the one upstream of it
    const tn = t.invoices.find((i) => i.company === "tien_ngai")?.finalTotal ?? 0;
    const pr = t.invoices.find((i) => i.company === "prim")?.finalTotal ?? 0;
    const c3 = t.invoices.find((i) => i.company === "3c")?.finalTotal ?? 0;
    tierMargin.prim += pr - tn;
    tierMargin["3c"] += c3 - pr;

    const tnInv = t.invoices.find((i) => i.company === "tien_ngai");
    tnInv?.lines.forEach((l) => {
      const p = byProduct.get(l.description) ?? { qty: 0, sell: 0 };
      p.qty += l.qty;
      p.sell += l.total;
      byProduct.set(l.description, p);
    });
  }

  const maxSell = Math.max(1, ...[...byProduct.values()].map((p) => p.sell));
  const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  const maxMonth = Math.max(1, ...months.map((m) => m.sell));
  const maxTier = Math.max(1, tierMargin.prim, tierMargin["3c"]);

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

        <Card title="Monthly trend">
          {months.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">No data yet.</p>
          ) : (
            <div className="flex items-end gap-4 h-52 pt-4">
              {months.map((m) => (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                  <div className="text-[11px] tnum text-muted">{fmt2(m.sell)}</div>
                  <div className="w-full flex items-end justify-center gap-1 flex-1">
                    <div
                      className="w-1/2 max-w-[34px] bg-primary rounded-t"
                      style={{ height: `${(m.sell / maxMonth) * 100}%` }}
                      title={`Sales RM ${fmt2(m.sell)}`}
                    />
                    <div
                      className="w-1/2 max-w-[34px] bg-profit rounded-t"
                      style={{ height: `${(m.margin / maxMonth) * 100}%` }}
                      title={`Margin RM ${fmt2(m.margin)}`}
                    />
                  </div>
                  <div className="text-[11px] text-faint whitespace-nowrap">{m.label}</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 text-[12px] text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Sales</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-profit" /> Group margin</span>
          </div>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card title="Margin earned by tier">
            <div className="space-y-4">
              <TierBar label="Prim Paper" sub="margin on sale to 3C" value={tierMargin.prim} max={maxTier} cls="bg-amber-500" />
              <TierBar label="3C Industries" sub="margin on sale to customer" value={tierMargin["3c"]} max={maxTier} cls="bg-violet-500" />
            </div>
            <div className="mt-4 pt-3 border-t border-line flex justify-between text-[13px]">
              <span className="text-muted">Total group margin</span>
              <span className="tnum font-semibold text-profit">RM {fmt2(tierMargin.prim + tierMargin["3c"])}</span>
            </div>
          </Card>

          <Card title="Revenue by product">
            {byProduct.size === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {[...byProduct.entries()].map(([name, p]) => (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="truncate pr-2">{name}</span>
                      <span className="tnum text-muted shrink-0">{p.qty} · RM {fmt2(p.sell)}</span>
                    </div>
                    <div className="h-2.5 bg-canvas rounded">
                      <div className="h-2.5 bg-primary rounded" style={{ width: `${(p.sell / maxSell) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

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
                  <td colSpan={4} className="text-center text-slate-400 py-4">No data yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

function TierBar({ label, sub, value, max, cls }: { label: string; sub: string; value: number; max: number; cls: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>
          {label} <span className="text-faint text-[12px]">· {sub}</span>
        </span>
        <span className="tnum font-medium">RM {fmt2(value)}</span>
      </div>
      <div className="h-2.5 bg-canvas rounded">
        <div className={`h-2.5 rounded ${cls}`} style={{ width: `${(Math.max(0, value) / max) * 100}%` }} />
      </div>
    </div>
  );
}
