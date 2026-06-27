import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import { fmt2 } from "@/lib/money";
import QuoteActions from "@/components/QuoteActions";
import { IconArrowRight } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function QuotationViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await repo.getQuotation(id);
  if (!quote) notFound();

  const total = quote.lines.reduce((s, l) => s + l.qty * l.sellUnitPrice - (l.disc ?? 0), 0);

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
