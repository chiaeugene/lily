import { repo } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import SettingsClient from "@/components/SettingsClient";

export default async function SettingsPage() {
  const [companies, products, rules] = await Promise.all([
    repo.listCompanies(),
    repo.listProducts(),
    repo.listMarginRules(),
  ]);

  return (
    <>
      <PageHeader title="Settings" sub="Company details and the margins that drive the invoice cascade" />
      <div className="p-4 md:p-8 max-w-[1200px] w-full">
        <SettingsClient companies={companies} products={products} rules={rules} />
      </div>
    </>
  );
}
