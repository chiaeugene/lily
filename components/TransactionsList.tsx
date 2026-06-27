"use client";

import { useState } from "react";
import Link from "next/link";
import type { Transaction } from "@/lib/types";
import { CompanyBadge } from "@/components/ui";
import InvoiceViewer, { InvoiceRef } from "@/components/InvoiceViewer";
import { IconEye, IconPrinter, IconDownload } from "@/components/icons";
import { fmt2 } from "@/lib/money";

function IconBtn({
  title,
  onClick,
  href,
  children,
}: {
  title: string;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  const cls =
    "inline-grid place-items-center h-8 w-8 rounded-lg text-muted hover:text-primary hover:bg-primary-soft";
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" title={title} aria-label={title} className={cls}>
        {children}
      </a>
    );
  return (
    <button title={title} aria-label={title} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export default function TransactionsList({ transactions }: { transactions: Transaction[] }) {
  const [active, setActive] = useState<InvoiceRef | null>(null);

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted">No transactions yet.</p>
        <p className="text-[13px] text-faint mt-1">Verify a pending order to generate the first invoice cascade.</p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-line">
        {transactions.map((t) => (
          <div key={t.id} className="py-3.5 first:pt-0 last:pb-0">
            {/* transaction summary — name+meta stack on the left, totals on the right */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/transaction/${t.id}`} className="font-medium text-sm text-ink hover:text-primary block truncate">
                  {t.customerName}
                </Link>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[11px] text-faint">{t.id}</span>
                  <span className="text-[12px] text-muted">{t.date}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 sm:gap-5 shrink-0">
                <div className="text-right">
                  <div className="text-[11px] text-faint">Sales</div>
                  <div className="tnum text-sm font-medium">RM {fmt2(t.grandTotalSell)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-faint">Margin</div>
                  <div className="tnum text-sm font-medium text-profit">RM {fmt2(t.marginCaptured)}</div>
                </div>
              </div>
            </div>
            {/* the three cascade invoices, one per line */}
            <div className="mt-2.5 rounded-lg border border-line divide-y divide-line overflow-hidden">
              {t.invoices.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-3 py-2 hover:bg-canvas">
                  <CompanyBadge company={inv.company} />
                  <span className="font-mono text-[12px] text-ink">{inv.invoiceNo}</span>
                  <span className="text-[12px] text-faint hidden sm:inline">→ {inv.toName}</span>
                  <span className="ml-auto tnum text-[13px] font-medium">RM {fmt2(inv.finalTotal)}</span>
                  <div className="flex items-center gap-0.5">
                    <IconBtn
                      title="View"
                      onClick={() =>
                        setActive({ id: inv.id, company: inv.company, invoiceNo: inv.invoiceNo, finalTotal: inv.finalTotal })
                      }
                    >
                      <IconEye size={17} />
                    </IconBtn>
                    <IconBtn title="Print / Send" href={`/api/invoice/${inv.id}/pdf`}>
                      <IconPrinter size={17} />
                    </IconBtn>
                    <IconBtn title="Save" href={`/api/invoice/${inv.id}`}>
                      <IconDownload size={17} />
                    </IconBtn>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <InvoiceViewer invoice={active} onClose={() => setActive(null)} />
    </>
  );
}
