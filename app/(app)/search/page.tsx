import Link from "next/link";
import { repo } from "@/lib/repo";
import { PageHeader, Card, CompanyBadge } from "@/components/ui";
import { fmt2 } from "@/lib/money";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = q ? await repo.search(q) : [];

  return (
    <>
      <PageHeader title="Search" sub="Find transactions by customer, invoice number, or product" />
      <div className="p-8 space-y-6">
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="e.g. KF Advisor, INV-187881, thermal paper…"
            className="flex-1 bg-white border border-line rounded-lg px-4 py-2.5 text-sm shadow-card"
          />
          <button className="bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg px-5">Search</button>
        </form>

        <Card title={q ? `Results for "${q}" (${results.length})` : "Enter a search term"}>
          {q && results.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No matches.</p>
          ) : (
            <div className="space-y-2">
              {results.map((t) => (
                <Link
                  key={t.id}
                  href={`/transaction/${t.id}`}
                  className="flex items-center gap-3 border border-line rounded-lg px-4 py-3 hover:bg-slate-50"
                >
                  <span className="font-mono text-xs">{t.id}</span>
                  <span className="font-medium">{t.customerName}</span>
                  <span className="text-slate-400 text-xs">{t.date}</span>
                  <span className="ml-auto flex gap-1">
                    {t.invoices.map((i) => (
                      <CompanyBadge key={i.id} company={i.company} />
                    ))}
                  </span>
                  <span className="tnum text-sm">RM {fmt2(t.grandTotalSell)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
