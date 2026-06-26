import { PageHeader, Card } from "@/components/ui";
import { IconQuote } from "@/components/icons";

export default function QuotationPage() {
  return (
    <>
      <PageHeader title="Quotation" sub="Draft and send price quotes before an order is confirmed" />
      <div className="p-4 md:p-8">
        <Card>
          <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
            <span className="h-14 w-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <IconQuote size={26} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Under construction</h2>
              <p className="text-[13px] text-muted mt-1 max-w-sm">
                The Quotation tool is being built. Soon you&rsquo;ll be able to create,
                price, and send quotes here, then turn an accepted quote into an order
                with one click.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
