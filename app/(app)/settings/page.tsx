import { repo } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import SettingsClient from "@/components/SettingsClient";
import CatalogClient from "@/components/CatalogClient";

export default async function SettingsPage() {
  const [companies, products, rules, customers] = await Promise.all([
    repo.listCompanies(),
    repo.listProducts(),
    repo.listMarginRules(),
    repo.listCustomers(),
  ]);

  return (
    <>
      <PageHeader title="Settings" sub="Customers, products, company details and the margins that drive the cascade" />
      <div className="p-4 md:p-8 max-w-[1200px] w-full mx-auto space-y-6">
        <CatalogClient customers={customers} products={products} />
        <SettingsClient companies={companies} products={products} rules={rules} />
      </div>
    </>
  );
}
