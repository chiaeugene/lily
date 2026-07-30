import { repo } from "@/lib/repo";
import { PageHeader, Card } from "@/components/ui";
import TransactionsList from "@/components/TransactionsList";
import ExportBar from "@/components/ExportBar";
import { getTenantCompanies } from "@/lib/tenantCompanies";
import { COMPANY_LABELS } from "@/lib/companies";
import type { CompanyKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const [txs, tenantCompanies] = await Promise.all([repo.allTransactions(), getTenantCompanies()]);
  const companyOpts = tenantCompanies.map((c) => ({
    value: c.key,
    // Prefer the short UI label where one exists (Tien Ngai group); other
    // tenants' entities show their registered name.
    label: COMPANY_LABELS[c.key as CompanyKey] ?? c.name,
  }));

  return (
    <>
      <PageHeader title="Records" sub="Full transaction archive" />
      <div className="p-4 md:p-8 space-y-6 max-w-[1200px] w-full mx-auto">
        <Card title="Export">
          <ExportBar companies={companyOpts} />
        </Card>

        <Card title={`All transactions · ${txs.length}`}>
          <TransactionsList transactions={txs} />
        </Card>
      </div>
    </>
  );
}
