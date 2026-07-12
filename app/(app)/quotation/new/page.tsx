import { repo } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import QuoteBuilder from "@/components/QuoteBuilder";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage() {
  const [products, customers] = await Promise.all([repo.listProducts(), repo.listCustomers()]);

  return (
    <>
      <PageHeader title="New quotation" sub="Pick a customer and add products from the catalog" />
      <div className="p-4 md:p-8 max-w-[900px] w-full mx-auto">
        <QuoteBuilder products={products} customers={customers} />
      </div>
    </>
  );
}
