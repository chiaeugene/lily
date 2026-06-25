import { fmt2 } from "@/lib/money";

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
}: {
  label: string;
  value: number | string;
  tone?: "ink" | "profit" | "loss" | "primary";
  prefix?: string;
  hint?: string;
}) {
  const color =
    tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : tone === "primary" ? "text-primary" : "text-ink";
  return (
    <div className="bg-surface rounded-xl border border-line shadow-card p-5">
      <div className="text-[12px] font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className={`mt-2 text-[26px] font-semibold tnum leading-none ${color}`}>
        {prefix}
        {typeof value === "number" ? fmt2(value) : value}
      </div>
      {hint && <div className="mt-1.5 text-[12px] text-muted">{hint}</div>}
    </div>
  );
}

export function Card({
  title,
  children,
  action,
  pad = true,
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  pad?: boolean;
}) {
  return (
    <section className="bg-surface rounded-xl border border-line shadow-card">
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
  prim: { cls: "bg-amber-50 text-amber-700 ring-amber-200", label: "Prim Paper" },
  "3c": { cls: "bg-violet-50 text-violet-700 ring-violet-200", label: "3C Industries" },
  tien_ngai: { cls: "bg-blue-50 text-blue-700 ring-blue-200", label: "Tien Ngai" },
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
