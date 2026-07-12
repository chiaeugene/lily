import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import { fmt2 } from "@/lib/money";
import PoActions from "@/components/PoActions";
import { IconArrowRight } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const po = await repo.getPurchaseOrder(id);
  if (!po) notFound();

  const total = po.lines.reduce((s, l) => s + l.qty * l.unitPrice - (l.disc ?? 0), 0);

  return (
    <>
      <PageHeader
        title={`Purchase Order ${po.id}`}
        sub={`${po.supplierName} · RM ${fmt2(total)}`}
        action={
          <Link href="/po" className="text-[13px] font-medium text-primary hover:text-primary-hover hidden sm:inline">
            ← All purchase orders
          </Link>
        }
      />
      <div className="p-4 md:p-8 space-y-4 max-w-[900px] w-full mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {po.status === "confirmed" ? (
            <span className="text-[13px] text-emerald-700">
              Confirmed{po.linkedOrderId ? " — linked quotation's order is now pending in the dashboard." : "."}
            </span>
          ) : po.status === "cancelled" ? (
            <span className="text-[13px] text-muted">This purchase order was cancelled.</span>
          ) : (
            <span className="text-[13px] text-muted">
              Send this to the supplier, then confirm it once materials are secured
              {po.quotationId ? ` to release quotation ${po.quotationId}'s invoice.` : "."}
            </span>
          )}
          <PoActions id={po.id} status={po.status} />
        </div>

        {/* Document preview */}
        <div className="rounded-xl border border-line shadow-card overflow-hidden bg-white">
          <iframe
            src={`/api/po/${po.id}`}
            title={po.id}
            className="w-full border-0 bg-white"
            style={{ minHeight: "70vh" }}
          />
        </div>

        <Link href="/po" className="sm:hidden inline-flex items-center gap-1 text-[13px] font-medium text-primary">
          All purchase orders <IconArrowRight size={15} />
        </Link>
      </div>
    </>
  );
}
