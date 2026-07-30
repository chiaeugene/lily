import Link from "next/link";
import { repo } from "@/lib/repo";
import { PageHeader, Card, KpiCard } from "@/components/ui";
import { fmt2 } from "@/lib/money";
import { paymentState, daysOverdue, dueDate } from "@/lib/payment";
import { IconReceipt, IconArrowRight, IconPrinter } from "@/components/icons";

export const dynamic = "force-dynamic";

const STATUS_CLS: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
  void: "bg-slate-100 text-slate-500 border-slate-200",
};

/**
 * Every invoice issued, as its own row.
 *
 * Invoices previously had no tab of their own — they were reachable only by
 * drilling into a transaction from Records, which reads as an archive. For a
 * business, the invoice IS the revenue document, so it belongs beside
 * Quotation and Purchase Orders rather than buried two levels down.
 */
export default async function InvoicesPage() {
  const txs = await repo.allTransactions();

  // Flatten to one row per invoice, newest first, carrying its parent's
  // payment state (payment is tracked per transaction, not per tier).
  const rows = txs
    .flatMap((t) =>
      t.invoices.map((inv) => ({
        inv,
        tx: t,
        state: t.status === "void" ? "void" : paymentState(t),
        overdue: daysOverdue(t),
        due: dueDate(t),
      })),
    )
    .sort((a, b) => b.tx.createdAt.localeCompare(a.tx.createdAt));

  const active = txs.filter((t) => t.status !== "void");
  const invoiced = active.reduce((s, t) => s + t.grandTotalSell, 0);
  const collected = active.filter((t) => paymentState(t) === "paid").reduce((s, t) => s + t.grandTotalSell, 0);
  const overdueTotal = active.filter((t) => paymentState(t) === "overdue").reduce((s, t) => s + t.grandTotalSell, 0);

  return (
    <>
      <PageHeader title="Invoices" sub="Every invoice issued, and whether it's been paid" />
      <div className="p-4 md:p-8 max-w-[1200px] w-full mx-auto space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Invoiced" value={invoiced} prefix="RM " hint={`${rows.length} invoice${rows.length === 1 ? "" : "s"}`} icon={<IconReceipt size={15} />} />
          <KpiCard label="Collected" value={collected} prefix="RM " tone="profit" hint="marked paid" />
          <KpiCard label="Outstanding" value={invoiced - collected} prefix="RM " tone={invoiced - collected ? "primary" : "ink"} hint="not yet paid" />
          <KpiCard label="Overdue" value={overdueTotal} prefix="RM " tone={overdueTotal ? "loss" : "ink"} hint="past due date" href="/pending" />
        </div>

        <Card title={`All invoices · ${rows.length}`} pad={false}>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 gap-3 px-4">
              <span className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <IconReceipt size={22} />
              </span>
              <p className="text-[14px] font-medium text-ink">No invoices yet</p>
              <p className="text-[13px] text-muted max-w-xs">
                Verify an order in Pending review and its invoice appears here.
              </p>
              <Link href="/pending" className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:text-primary-hover">
                Go to Pending review <IconArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-faint border-b border-line">
                    <th className="py-2 px-3 font-medium">Invoice</th>
                    <th className="py-2 px-3 font-medium">Customer</th>
                    <th className="py-2 px-3 font-medium">Date</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium text-right">Amount</th>
                    <th className="py-2 px-3 font-medium text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ inv, tx, state, overdue, due }) => (
                    <tr key={inv.id} className="border-b border-line last:border-0 hover:bg-canvas">
                      <td className="py-2.5 px-3">
                        <Link href={`/transaction/${tx.id}`} className="font-medium text-ink hover:text-primary">
                          {inv.invoiceNo}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-muted truncate max-w-[220px]">{inv.toName}</td>
                      <td className="py-2.5 px-3 text-muted whitespace-nowrap">{inv.date}</td>
                      <td className="py-2.5 px-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_CLS[state]}`}>
                          {state === "overdue" ? `Overdue ${overdue}d` : state === "paid" ? "Paid" : state === "void" ? "Void" : "Unpaid"}
                        </span>
                        {state === "unpaid" && due && (
                          <span className="ml-2 text-[11px] text-faint whitespace-nowrap">due {due.toLocaleDateString("en-MY")}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right tnum font-semibold whitespace-nowrap">{fmt2(inv.finalTotal)}</td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <a href={`/api/invoice/${inv.id}`} target="_blank" rel="noreferrer" className="text-[12px] text-primary hover:text-primary-hover">
                          View
                        </a>
                        <span className="mx-1.5 text-line">|</span>
                        <a href={`/api/invoice/${inv.id}/pdf?download=1`} className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
                          <IconPrinter size={13} /> PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Link href="/records" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:text-primary-hover">
          Full archive &amp; export <IconArrowRight size={15} />
        </Link>
      </div>
    </>
  );
}
