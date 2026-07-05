import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import { fmt2 } from "@/lib/money";
import QuoteActions from "@/components/QuoteActions";
import { IconArrowRight, IconBox } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function QuotationViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await repo.getQuotation(id);
  if (!quote) notFound();

  const total = quote.lines.reduce((s, l) => s + l.qty * l.sellUnitPrice - (l.disc ?? 0), 0);
  const pos = (await repo.listPurchaseOrders()).filter((p) => p.quotationId === id);

  return (
    <>
      <PageHeader
        title={`Quotation ${quote.id}`}
        sub={`${quote.customerName} · RM ${fmt2(total)}`}
        action={
          <Link href="/quotation" className="text-[13px] font-medium text-primary hover:text-primary-hover hidden sm:inline">
            ← All quotations
          </Link>
        }
      />
      <div className="p-4 md:p-8 space-y-4 max-w-[900px] w-full">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {quote.status === "accepted" ? (
            <span className="text-[13px] text-emerald-700">This quote was accepted and converted to an order.</span>
          ) : (
            <span className="text-[13px] text-muted">Send this to the customer, then accept it to generate the 3-invoice cascade.</span>
          )}
          <QuoteActions id={quote.id} status={quote.status} />
        </div>

        {quote.status !== "accepted" && (
          <div className="rounded-xl border border-line bg-canvas p-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <IconBox size={16} className="text-slate-400" />
              Need to buy materials from a supplier first? Create a purchase order — confirming it will spawn this
              quote&apos;s order automatically.
            </div>
            <Link
              href={`/po/new?quotationId=${quote.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white text-ink text-[13px] font-medium px-3.5 py-2 hover:bg-slate-50 shrink-0"
            >
              Create Purchase Order <IconArrowRight size={14} />
            </Link>
          </div>
        )}

        {pos.length > 0 && (
          <div className="rounded-xl border border-line divide-y divide-line overflow-hidden">
            {pos.map((p) => (
              <Link key={p.id} href={`/po/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <span className="font-mono text-[12px] text-muted">{p.id}</span>
                <span className="text-[13px] text-ink">{p.supplierName}</span>
                <span
                  className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    p.status === "confirmed"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : p.status === "cancelled"
                        ? "bg-slate-100 text-slate-500 border-slate-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {p.status}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Document preview */}
        <div className="rounded-xl border border-line shadow-card overflow-hidden bg-white">
          <iframe
            src={`/api/quotation/${quote.id}`}
            title={quote.id}
            className="w-full border-0 bg-white"
            style={{ minHeight: "70vh" }}
          />
        </div>

        <Link href="/quotation" className="sm:hidden inline-flex items-center gap-1 text-[13px] font-medium text-primary">
          All quotations <IconArrowRight size={15} />
        </Link>
      </div>
    </>
  );
}
