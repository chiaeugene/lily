import Link from "next/link";
import { repo } from "@/lib/repo";
import { PageHeader, Card } from "@/components/ui";
import { fmt2 } from "@/lib/money";
import { IconQuote, IconArrowRight } from "@/components/icons";

export const dynamic = "force-dynamic";

function quoteTotal(lines: { qty: number; sellUnitPrice: number; disc?: number }[]) {
  return lines.reduce((s, l) => s + l.qty * l.sellUnitPrice - (l.disc ?? 0), 0);
}

const STATUS: Record<string, { label: string; cls: string }> = {
  quote: { label: "Open", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  accepted: { label: "Accepted", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default async function QuotationPage() {
  const quotes = await repo.listQuotations();

  return (
    <>
      <PageHeader
        title="Quotation"
        sub="Draft price quotes — accept one to turn it into an order"
        action={
          <Link
            href="/quotation/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-[13px] font-medium px-3.5 py-2"
          >
            <span className="text-base leading-none">+</span> New quote
          </Link>
        }
      />
      <div className="p-4 md:p-8">
        <Card pad={false}>
          {quotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 gap-3 px-4">
              <span className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <IconQuote size={22} />
              </span>
              <p className="text-[14px] font-medium text-ink">No quotations yet</p>
              <p className="text-[13px] text-muted max-w-xs">
                Create a quote, send it to your customer, and accept it to generate the invoice cascade.
              </p>
              <Link
                href="/quotation/new"
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-[13px] font-medium px-4 py-2"
              >
                Create first quote <IconArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {quotes.map((q) => {
                const st = STATUS[q.status] ?? STATUS.quote;
                return (
                  <li key={q.id}>
                    <Link
                      href={`/quotation/${q.id}`}
                      className="flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-slate-50 active:bg-slate-100"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[12px] text-muted shrink-0">{q.id}</span>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
                            {st.label}
                          </span>
                        </div>
                        <div className="mt-0.5 font-medium text-[14px] text-ink truncate">{q.customerName}</div>
                        <div className="text-[12px] text-muted">{q.date} · {q.lines.length} item{q.lines.length > 1 ? "s" : ""}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="tnum font-semibold text-[14px] text-ink">RM {fmt2(quoteTotal(q.lines))}</div>
                      </div>
                      <IconArrowRight size={16} className="text-slate-300 shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
