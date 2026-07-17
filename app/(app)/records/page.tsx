import { repo } from "@/lib/repo";
import { PageHeader, Card } from "@/components/ui";
import TransactionsList from "@/components/TransactionsList";
import ExportBar from "@/components/ExportBar";

export default async function RecordsPage() {
  const txs = await repo.allTransactions();

  return (
    <>
      <PageHeader title="Records" sub="Full transaction archive" />
      <div className="p-4 md:p-8 space-y-6 max-w-[1200px] w-full mx-auto">
        <Card title="Export">
          <ExportBar />
        </Card>

        <Card title={`All transactions · ${txs.length}`}>
          <TransactionsList transactions={txs} />
        </Card>
      </div>
    </>
  );
}
