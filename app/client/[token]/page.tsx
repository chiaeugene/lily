import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { paymentState, daysOverdue } from "@/lib/payment";
import { fmt2 } from "@/lib/money";
import { LilyMark } from "@/components/Logo";

export const dynamic = "force-dynamic";

const STATUS_CLS: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
};

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customer = await repo.getCustomerByPortalToken(token);
  if (!customer) notFound();

  const allTx = await repo.search(customer.name);
  const txs = allTx
    .filter((t) => t.customerName === customer.name && t.status !== "void")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const outstanding = txs.filter((t) => paymentState(t) !== "paid").reduce((s, t) => s + t.grandTotalSell, 0);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="max-w-[820px] mx-auto px-5 py-5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary-light to-primary text-white grid place-items-center shrink-0">
            <LilyMark size={18} mono />
          </div>
          <div>
            <div className="text-[13px] text-muted">Your account with</div>
            <div className="text-[16px] font-semibold text-ink">Tien Ngai Machinery Group</div>
          </div>
        </div>
      </header>

      <main className="max-w-[820px] mx-auto px-5 py-8">
        <h1 className="text-xl font-semibold text-ink">{customer.name}</h1>
        {outstanding > 0 && (
          <p className="mt-1 text-[14px] text-muted">
            Outstanding balance: <span className="font-semibold text-ink">RM {fmt2(outstanding)}</span>
          </p>
        )}

        <div className="mt-6 bg-surface border border-line rounded-2xl overflow-hidden">
          {txs.length === 0 ? (
            <p className="text-sm text-muted py-10 text-center">No invoices on file yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {txs.map((t) => {
                const inv = t.invoices.find((i) => i.toName === customer.name) ?? t.invoices[t.invoices.length - 1];
                const state = paymentState(t);
                const overdue = daysOverdue(t);
                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium text-ink">{inv?.invoiceNo ?? t.id}</div>
                      <div className="text-[12px] text-muted">{t.date}</div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[state]}`}>
                      {state === "overdue" ? `Overdue ${overdue}d` : state === "paid" ? "Paid" : "Unpaid"}
                    </span>
                    <div className="text-right shrink-0 w-24 tnum font-semibold text-[14px] text-ink">
                      RM {fmt2(t.grandTotalSell)}
                    </div>
                    {inv && (
                      <a
                        href={`/api/client/${token}/invoice/${inv.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-[13px] font-medium text-primary hover:text-primary-hover"
                      >
                        View
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="mt-6 text-[12px] text-faint text-center">
          Questions about an invoice? Contact us directly — this page is read-only.
        </p>
      </main>
    </div>
  );
}
