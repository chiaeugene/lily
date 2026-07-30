import Link from "next/link";
import { repo } from "@/lib/repo";
import { PageHeader, Card } from "@/components/ui";
import JourneySearch from "@/components/JourneySearch";
import { IconRoute, IconArrowRight } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function JourneyIndexPage() {
  const [quotations, pos] = await Promise.all([repo.listQuotations(), repo.listPurchaseOrders()]);
  const recent = [
    ...quotations.slice(0, 8).map((q) => ({ id: q.id, label: `Quotation — ${q.customerName}`, date: q.date })),
    ...pos.slice(0, 8).map((p) => ({ id: p.id, label: `PO — ${p.supplierName}`, date: p.date })),
  ]
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 10);

  return (
    <>
      <PageHeader title="Order Journey" sub="Trace one request across quote, purchase order, invoice, and payment" />
      <div className="p-4 md:p-8 max-w-[900px] w-full mx-auto space-y-6">
        <Card>
          <JourneySearch />
        </Card>

        <Card title="Recent — jump straight in" pad={false}>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 gap-3 px-4">
              <span className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <IconRoute size={22} />
              </span>
              <p className="text-[13px] text-muted max-w-xs">No quotations or purchase orders yet — create one to see its journey here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/journey/${r.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 active:bg-slate-100">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-ink">{r.label}</div>
                      <div className="text-[12px] text-faint">{r.id} · {r.date}</div>
                    </div>
                    <IconArrowRight size={16} className="text-slate-300 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
