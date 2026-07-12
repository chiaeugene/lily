import Link from "next/link";
import { repo } from "@/lib/repo";
import { PageHeader, Card } from "@/components/ui";
import { fmt2 } from "@/lib/money";
import { IconBox, IconArrowRight } from "@/components/icons";

export const dynamic = "force-dynamic";

function poTotal(lines: { qty: number; unitPrice: number; disc?: number }[]) {
  return lines.reduce((s, l) => s + l.qty * l.unitPrice - (l.disc ?? 0), 0);
}

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  confirmed: { label: "Confirmed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

export default async function PurchaseOrderPage() {
  const pos = await repo.listPurchaseOrders();

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        sub="Procurement orders to suppliers — confirm one to unlock its linked quotation's invoice"
        action={
          <Link
            href="/po/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-[13px] font-medium px-3.5 py-2"
          >
            <span className="text-base leading-none">+</span> New PO
          </Link>
        }
      />
      <div className="p-4 md:p-8 max-w-[1200px] w-full mx-auto">
        <Card pad={false}>
          {pos.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 gap-3 px-4">
              <span className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <IconBox size={22} />
              </span>
              <p className="text-[14px] font-medium text-ink">No purchase orders yet</p>
              <p className="text-[13px] text-muted max-w-xs">
                Create a PO for a supplier — link it to a quotation to automatically create the sell-order once confirmed.
              </p>
              <Link
                href="/po/new"
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-[13px] font-medium px-4 py-2"
              >
                Create first PO <IconArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {pos.map((p) => {
                const st = STATUS[p.status] ?? STATUS.draft;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/po/${p.id}`}
                      className="flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-slate-50 active:bg-slate-100"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[12px] text-muted shrink-0">{p.id}</span>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
                            {st.label}
                          </span>
                          {p.quotationId && (
                            <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
                              for {p.quotationId}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 font-medium text-[14px] text-ink truncate">{p.supplierName}</div>
                        <div className="text-[12px] text-muted">{p.date} · {p.lines.length} item{p.lines.length > 1 ? "s" : ""}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="tnum font-semibold text-[14px] text-ink">RM {fmt2(poTotal(p.lines))}</div>
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
