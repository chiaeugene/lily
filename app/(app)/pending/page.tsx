import Link from "next/link";
import { repo } from "@/lib/repo";
import { listExpenses } from "@/lib/expenses";
import { PageHeader, Card } from "@/components/ui";
import PendingList from "@/components/PendingList";
import ExpenseVerifyCard from "@/components/ExpenseVerifyCard";
import { IconCheck, IconArrowRight } from "@/components/icons";

export const dynamic = "force-dynamic";

// Everything waiting on a human decision, in one place — orders from the bot
// AND expenses awaiting verification. Previously "Review pending" was a
// dashboard anchor that dead-ended whenever the queue was empty.
export default async function PendingPage() {
  const [orders, expenses] = await Promise.all([repo.listPendingOrders(), listExpenses()]);
  const pendingExpenses = expenses.filter((e) => e.status === "pending_verification");
  const total = orders.length + pendingExpenses.length;

  return (
    <>
      <PageHeader
        title="Pending review"
        sub={total === 0 ? "Nothing waiting on you" : `${total} item${total === 1 ? "" : "s"} need your attention`}
      />
      <div className="p-4 md:p-8 max-w-[1000px] w-full mx-auto space-y-5">
        {total === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center text-center py-14 gap-3 px-4">
              <span className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <IconCheck size={22} />
              </span>
              <p className="text-[15px] font-medium text-ink">All clear</p>
              <p className="text-[13px] text-muted max-w-sm">
                No orders or expenses waiting. New items arrive here automatically when someone messages the Lily
                bot on Telegram.
              </p>
              <Link
                href="/dashboard"
                className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:text-primary-hover"
              >
                Back to dashboard <IconArrowRight size={15} />
              </Link>
            </div>
          </Card>
        ) : (
          <>
            {orders.length > 0 && (
              <Card title={`Orders awaiting verification · ${orders.length}`}>
                <PendingList orders={orders} />
              </Card>
            )}
            {pendingExpenses.length > 0 && (
              <Card title={`Expenses awaiting verification · ${pendingExpenses.length}`}>
                <div className="space-y-3">
                  {pendingExpenses.map((e) => (
                    <ExpenseVerifyCard key={e.id} expense={e} />
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
