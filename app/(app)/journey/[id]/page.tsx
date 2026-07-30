import Link from "next/link";
import { buildJourney } from "@/lib/journey";
import { PageHeader, Card } from "@/components/ui";
import { fmt2 } from "@/lib/money";
import { IconArrowRight, IconRoute } from "@/components/icons";

export const dynamic = "force-dynamic";

const TONE_CLS: Record<string, string> = {
  ink: "bg-slate-100 text-slate-600 border-slate-200",
  profit: "bg-emerald-50 text-emerald-700 border-emerald-200",
  loss: "bg-red-50 text-red-700 border-red-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  muted: "bg-slate-100 text-slate-500 border-slate-200",
};

const STAGE_LABEL: Record<string, string> = {
  quotation: "Quotation",
  purchase_order: "Purchase Order",
  order: "Order",
  transaction: "Invoice / Payment",
};

export default async function JourneyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const journey = await buildJourney(id);

  return (
    <>
      <PageHeader title="Order Journey" sub={journey ? `Tracking ${id}` : `No match for "${id}"`} />
      <div className="p-4 md:p-8 max-w-[900px] w-full mx-auto space-y-5">
        {!journey ? (
          <Card>
            <div className="flex flex-col items-center justify-center text-center py-12 gap-3 px-4">
              <span className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <IconRoute size={22} />
              </span>
              <p className="text-[14px] font-medium text-ink">Nothing found for &quot;{id}&quot;</p>
              <p className="text-[13px] text-muted max-w-xs">
                Check the ID — it should look like QT-2607-001, PO-2607-001, ord-xxxxx, or TX-XXXXXXXX.
              </p>
              <Link href="/journey" className="mt-1 text-[13px] font-medium text-primary hover:text-primary-hover">
                Back to search
              </Link>
            </div>
          </Card>
        ) : (
          <Card title="Trail" pad={false}>
            <ul className="divide-y divide-line">
              {journey.steps.map((s, i) => (
                <li key={s.id} className="flex items-start gap-3 px-4 sm:px-5 py-4">
                  <div className="flex flex-col items-center pt-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                    {i < journey.steps.length - 1 && <span className="w-px flex-1 bg-line mt-1" style={{ minHeight: 24 }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-wide text-faint">{STAGE_LABEL[s.stage]}</div>
                    <Link href={s.href} className="text-[14px] font-medium text-ink hover:text-primary">
                      {s.title}
                    </Link>
                    <div className="text-[12px] text-muted mt-0.5">{s.date}{s.amount !== undefined ? ` · RM ${fmt2(s.amount)}` : ""}</div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE_CLS[s.statusTone]}`}>
                    {s.status}
                  </span>
                  <Link href={s.href} className="shrink-0 text-slate-300 hover:text-primary pt-1">
                    <IconArrowRight size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {journey && journey.steps.length < 4 && (
          <p className="text-[12px] text-faint">
            {journey.transaction ? "This request is fully invoiced." : "This request hasn't reached invoicing yet — earlier or later stages may not exist for this particular order."}
          </p>
        )}
      </div>
    </>
  );
}
