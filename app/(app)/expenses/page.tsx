import { listExpenses, listPaymentVouchers } from "@/lib/expenses";
import { PageHeader, Card } from "@/components/ui";
import { fmt2 } from "@/lib/money";
import ExpenseVerifyCard from "@/components/ExpenseVerifyCard";
import ExpenseListRow from "@/components/ExpenseListRow";
import AddExpenseButton from "@/components/AddExpenseButton";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const [expenses, vouchers] = await Promise.all([listExpenses(), listPaymentVouchers()]);
  const pending = expenses.filter((e) => e.status === "pending_verification");
  const others = expenses.filter((e) => e.status !== "pending_verification");

  return (
    <>
      <PageHeader
        title="Expenses"
        sub="Captured via Telegram (text or receipt photo) or added manually — verify, then pay to count toward P&L"
        action={<AddExpenseButton />}
      />
      <div className="p-4 md:p-8 max-w-[1000px] w-full mx-auto space-y-6">
        {pending.length > 0 && (
          <Card title={`Pending verification · ${pending.length}`}>
            <div className="space-y-3">
              {pending.map((e) => (
                <ExpenseVerifyCard key={e.id} expense={e} />
              ))}
            </div>
          </Card>
        )}

        <Card title={`All expenses · ${others.length}`}>
          {others.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">
              Nothing yet — send a message or receipt photo to the Telegram bot, or add one manually.
            </p>
          ) : (
            <div className="space-y-2">
              {others.map((e) => (
                <ExpenseListRow key={e.id} expense={e} />
              ))}
            </div>
          )}
        </Card>

        <Card title={`Payment vouchers · ${vouchers.length}`} pad={false}>
          {vouchers.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-faint border-b border-line">
                    <th className="py-2 px-3 font-medium">Voucher</th>
                    <th className="py-2 px-3 font-medium">Vendor</th>
                    <th className="py-2 px-3 font-medium">Date</th>
                    <th className="py-2 px-3 font-medium">Method</th>
                    <th className="py-2 px-3 font-medium">Reference</th>
                    <th className="py-2 px-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v) => (
                    <tr key={v.id} className="border-b border-line last:border-0">
                      <td className="py-2 px-3 font-mono text-[12px] text-muted">{v.id}</td>
                      <td className="py-2 px-3 text-ink font-medium">{v.vendorName}</td>
                      <td className="py-2 px-3 text-muted">{v.paidDate}</td>
                      <td className="py-2 px-3 text-muted">{v.method}</td>
                      <td className="py-2 px-3 text-muted">{v.reference || "—"}</td>
                      <td className="py-2 px-3 text-right tnum font-semibold">{fmt2(v.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
