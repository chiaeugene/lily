import { repo } from "@/lib/repo";
import { listStaff } from "@/lib/staff";
import { PageHeader } from "@/components/ui";
import SettingsClient from "@/components/SettingsClient";
import CatalogClient from "@/components/CatalogClient";
import StaffClient from "@/components/StaffClient";

export default async function SettingsPage() {
  const [companies, products, rules, customers, staff] = await Promise.all([
    repo.listCompanies(),
    repo.listProducts(),
    repo.listMarginRules(),
    repo.listCustomers(),
    listStaff(),
  ]);

  return (
    <>
      <PageHeader title="Settings" sub="Customers, products, company details and the margins that drive the cascade" />
      <div className="p-4 md:p-8 max-w-[1200px] w-full mx-auto space-y-6">
        <StaffClient staff={staff} />
        <CatalogClient customers={customers} products={products} />
        <SettingsClient companies={companies} products={products} rules={rules} />
      </div>
    </>
  );
}
