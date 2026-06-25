import { repo } from "@/lib/repo";
import { PageHeader, Card } from "@/components/ui";
import TransactionsList from "@/components/TransactionsList";

export default async function RecordsPage() {
  const [txs, audit] = await Promise.all([
    repo.allTransactions(),
    repo.audit(30),
  ]);

  return (
    <>
      <PageHeader title="Records" sub="Full transaction archive and audit log" />
      <div className="p-8 space-y-6 max-w-[1200px] w-full">
        <Card title={`All transactions · ${txs.length}`}>
          <TransactionsList transactions={txs} />
        </Card>

        <Card title="Audit log">
          <div className="space-y-1.5 text-[12px] font-mono">
            {audit.map((a) => (
              <div key={a.id} className="flex gap-3 text-muted">
                <span className="text-faint shrink-0">{new Date(a.at).toLocaleString("en-MY")}</span>
                <span className="text-primary shrink-0">{a.action}</span>
                <span className="shrink-0">{a.actor}</span>
                <span className="text-muted truncate">{a.detail}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
