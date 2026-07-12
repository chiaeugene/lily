import { repo } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import PoBuilder from "@/components/PoBuilder";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ quotationId?: string }>;
}) {
  const { quotationId } = await searchParams;
  const quote = quotationId ? await repo.getQuotation(quotationId) : undefined;

  return (
    <>
      <PageHeader
        title="New purchase order"
        sub={quote ? `Procurement for quotation ${quote.id} — ${quote.customerName}` : "Order raw materials from a supplier"}
      />
      <div className="p-4 md:p-8 max-w-[900px] w-full mx-auto">
        <PoBuilder quotationId={quote?.id} defaultYourRef={quote?.id} />
      </div>
    </>
  );
}
