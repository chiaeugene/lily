import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { PageHeader, CompanyBadge } from "@/components/ui";
import { IconDownload } from "@/components/icons";
import { fmt2 } from "@/lib/money";

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tx = await repo.getTransaction(id);
  if (!tx) notFound();

  return (
    <>
      <PageHeader
        title={`Transaction ${tx.id}`}
        sub={`${tx.customerName} · ${tx.date} · one order → three linked invoices`}
      />
      <div className="p-8 space-y-6">
        <div className="bg-white rounded-xl shadow-card p-5 flex flex-wrap gap-8 text-sm">
          <div>
            <div className="text-xs text-slate-400">Customer pays (3C)</div>
            <div className="text-lg font-bold tnum">RM {fmt2(tx.grandTotalSell)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Group margin captured</div>
            <div className="text-lg font-bold tnum text-profit">RM {fmt2(tx.marginCaptured)}</div>
          </div>
          <div className="ml-auto self-center">
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
          Flow: <b>Tien Ngai Machinery</b> bills <b>Prim Paper</b> · Prim bills <b>3C Industries</b> · 3C bills{" "}
          <b>{tx.customerName}</b>. Same goods &amp; quantity; price rises at each tier per the margin rules.
        </p>
      </div>
    </>
  );
}
