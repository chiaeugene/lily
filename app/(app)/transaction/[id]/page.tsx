import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { PageHeader, CompanyBadge, PaymentStatusChip } from "@/components/ui";
import { IconDownload } from "@/components/icons";
import VoidButton from "@/components/VoidButton";
import MarkPaidButton from "@/components/MarkPaidButton";
import { fmt2 } from "@/lib/money";
import { dueDate } from "@/lib/payment";
import { COMPANY_LABELS } from "@/lib/companies";

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tx = await repo.getTransaction(id);
  if (!tx) notFound();

  const voided = tx.status === "void";
  const due = dueDate(tx);

  return (
    <>
      <PageHeader
        title={`Transaction ${tx.id}`}
        sub={`${tx.customerName} · ${tx.date} · one order → three linked invoices`}
      />
      <div className="p-4 md:p-8 space-y-6 max-w-[1300px] w-full mx-auto">
        {voided && (
          <div className="rounded-xl border border-loss/30 bg-loss-soft px-5 py-3 flex items-center gap-3">
            <span className="inline-flex items-center rounded-md bg-loss text-white text-[11px] font-bold px-2 py-0.5">VOID</span>
            <div className="text-[13px] text-loss">
              This transaction is voided{tx.voidReason ? ` — ${tx.voidReason}` : ""}. Its invoices carry a VOID
              watermark and are excluded from totals.
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-card p-5 flex flex-wrap items-center gap-8 text-sm">
          <div>
            <div className="text-xs text-slate-400">Customer pays (3C)</div>
            <div className={`text-lg font-bold tnum ${voided ? "line-through text-muted" : ""}`}>RM {fmt2(tx.grandTotalSell)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Group margin captured</div>
            <div className={`text-lg font-bold tnum ${voided ? "line-through text-muted" : "text-profit"}`}>RM {fmt2(tx.marginCaptured)}</div>
          </div>
          {!voided && (
            <div>
              <div className="text-xs text-slate-400">Payment</div>
              <div className="flex items-center gap-2 mt-0.5">
                <PaymentStatusChip tx={tx} />
                {due && <span className="text-xs text-muted">due {due.toLocaleDateString("en-MY")}</span>}
              </div>
            </div>
          )}
          <div className="ml-auto self-center flex items-center gap-2">
            {!voided && <MarkPaidButton transactionId={tx.id} paid={tx.paidStatus === "paid"} />}
            {!voided && <VoidButton transactionId={tx.id} />}
            <Link
              href={`/api/transaction/${tx.id}/pdf`}
              target="_blank"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg px-4 py-2"
            >
              <IconDownload size={16} /> Save all 3 (PDF bundle)
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {tx.invoices.map((inv) => (
            <div key={inv.id} className="bg-white rounded-xl shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                <div className="flex items-center gap-2">
                  <CompanyBadge company={inv.company} />
                  <span className="font-mono text-xs">{inv.invoiceNo}</span>
                </div>
                <span className="tnum text-sm font-semibold">RM {fmt2(inv.finalTotal)}</span>
              </div>
              <iframe
                src={`/api/invoice/${inv.id}`}
                className="w-full h-[520px] bg-white"
                title={inv.invoiceNo}
              />
              <div className="flex gap-2 px-4 py-3 border-t border-line text-sm">
                <Link href={`/api/invoice/${inv.id}`} target="_blank" className="text-brand hover:underline">
                  View / Print
                </Link>
                <span className="text-line">|</span>
                <Link href={`/api/invoice/${inv.id}/pdf`} target="_blank" className="text-brand hover:underline">
                  Save PDF
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400">
          Flow: <b>{COMPANY_LABELS.tien_ngai}</b> bills <b>{COMPANY_LABELS.prim}</b> · {COMPANY_LABELS.prim} bills{" "}
          <b>{COMPANY_LABELS["3c"]}</b> · {COMPANY_LABELS["3c"]} bills <b>{tx.customerName}</b>. Same goods &amp;
          quantity; price rises at each tier per the margin rules.
        </p>
      </div>
    </>
  );
}
