import Link from "next/link";
import { LilyMark } from "@/components/Logo";
import { fmt2 } from "@/lib/money";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardHero({
  pending,
  marginThisMonth,
}: {
  pending: number;
  marginThisMonth: number;
}) {
  const sub =
    pending > 0
      ? `${pending} order${pending > 1 ? "s" : ""} ${pending > 1 ? "are" : "is"} waiting on your review, and the group has captured RM ${fmt2(marginThisMonth)} in margin this month.`
      : `Nothing waiting on you right now — the group has captured RM ${fmt2(marginThisMonth)} in margin this month.`;

  return (
    <div className="relative rounded-2xl border border-line overflow-hidden p-7 sm:p-9 isolate">
      <div className="absolute inset-0 -z-20 bg-surface" />
      <div className="absolute -z-10 -top-32 -right-10 w-72 h-72 rounded-full opacity-40 blur-3xl bg-gradient-to-br from-primary-light to-primary" />
      <div className="absolute -z-10 bottom-[-90px] right-[180px] w-56 h-56 rounded-full opacity-20 blur-3xl bg-profit" />
      <div className="absolute right-[-14px] bottom-[-24px] -z-10 opacity-[0.08]" aria-hidden="true">
        <LilyMark size={200} />
      </div>

      <div className="text-[12px] font-semibold text-primary-hover uppercase tracking-wide flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-profit opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-profit" />
        </span>
        Tien Ngai Machinery · live
      </div>
      <h1 className="mt-2.5 text-[26px] sm:text-[30px] font-semibold tracking-tight text-ink max-w-lg leading-tight">
        {greeting()}
      </h1>
      <p className="mt-2 text-[14.5px] text-muted max-w-md leading-relaxed">{sub}</p>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Link
          href="#pending"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-[13.5px] font-medium px-4 py-2.5 transition-transform hover:-translate-y-px"
        >
          Review pending
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
        </Link>
        <Link
          href="/analysis"
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-line text-ink text-[13.5px] font-medium px-4 py-2.5 hover:shadow-lift transition-all hover:-translate-y-px"
        >
          View sales analysis
        </Link>
      </div>
    </div>
  );
}
