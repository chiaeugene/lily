import { fmt2 } from "@/lib/money";
import type { Transaction } from "@/lib/types";
import { paymentState, daysOverdue } from "@/lib/payment";
import { COMPANY_LABELS } from "@/lib/companies";

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-surface/85 backdrop-blur border-b border-line">
      <div className="pl-[72px] pr-6 md:px-8 h-16 flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-ink leading-tight">{title}</h1>
          {sub && <p className="text-[13px] text-muted">{sub}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function KpiCard({
  label,
  value,
  tone = "ink",
  prefix = "",
  hint,
  icon,
  deltaPct,
}: {
  label: string;
  value: number | string;
  tone?: "ink" | "profit" | "loss" | "primary";
  prefix?: string;
  hint?: string;
  icon?: React.ReactNode;
  /** Month-over-month % change. Omit entirely rather than fabricate — only pass when there's real prior-period data. */
  deltaPct?: number;
}) {
  const numColor =
    tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : tone === "primary" ? "text-primary" : "text-ink";
  const badgeCls =
    tone === "profit" ? "bg-profit-soft text-profit" : tone === "loss" ? "bg-loss-soft text-loss" : tone === "primary" ? "bg-primary-soft text-primary-hover" : "bg-surface-2 text-muted";
  return (
    <div className="bg-surface rounded-2xl border border-line shadow-card hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] font-medium text-muted">{label}</div>
        {icon && <div className={`h-7 w-7 rounded-lg grid place-items-center shrink-0 ${badgeCls}`}>{icon}</div>}
      </div>
      <div className={`mt-2.5 font-mono text-[24px] font-semibold tnum leading-none ${numColor}`}>
        {prefix}
        {typeof value === "number" ? fmt2(value) : value}
      </div>
      {deltaPct != null ? (
        <div className={`mt-1.5 text-[12px] font-medium ${deltaPct >= 0 ? "text-profit" : "text-loss"}`}>
          {deltaPct >= 0 ? "↑" : "↓"} {Math.abs(deltaPct).toFixed(1)}% vs last month
        </div>
      ) : hint ? (
        <div className="mt-1.5 text-[12px] text-faint">{hint}</div>
      ) : null}
    </div>
  );
}

export function Card({
  title,
  children,
  action,
  pad = true,
  id,
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  pad?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className="bg-surface rounded-xl border border-line shadow-card scroll-mt-20">
      {title && (
        <div className="flex items-center justify-between px-5 h-[52px] border-b border-line">
          <h2 className="font-semibold text-[14px] text-ink">{title}</h2>
          {action}
        </div>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

const COMPANY_STYLE: Record<string, { cls: string; label: string }> = {
  prim: { cls: "bg-amber-50 text-amber-700 ring-amber-200", label: COMPANY_LABELS.prim },
  "3c": { cls: "bg-violet-50 text-violet-700 ring-violet-200", label: COMPANY_LABELS["3c"] },
  tien_ngai: { cls: "bg-blue-50 text-blue-700 ring-blue-200", label: COMPANY_LABELS.tien_ngai },
};

export function CompanyBadge({ company }: { company: string }) {
  const s = COMPANY_STYLE[company] ?? { cls: "bg-slate-100 text-slate-600 ring-slate-200", label: company };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 85 ? "bg-profit-soft text-profit" : pct >= 60 ? "bg-warn-soft text-warn" : "bg-loss-soft text-loss";
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${tone}`}>AI {pct}%</span>;
}

/** Paid / Unpaid / Overdue (Nd) chip, computed from the transaction's terms + paid status. */
export function PaymentStatusChip({ tx }: { tx: Transaction }) {
  const state = paymentState(tx);
  if (state === "paid") {
    return <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-profit-soft text-profit">Paid</span>;
  }
  if (state === "overdue") {
    const d = daysOverdue(tx);
    return <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-loss-soft text-loss">Overdue {d}d</span>;
  }
  return <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-canvas text-muted border border-line">Unpaid</span>;
}
