import Link from "next/link";
import { LilyMark } from "@/components/Logo";
import { BorderBeam } from "@/components/ui/border-beam";
import { fmt2 } from "@/lib/money";

// Time-of-day greetings were read from the SERVER clock — UTC on Render, not
// Malaysia (UTC+8) — so it cheerfully said "Good morning" through the whole
// Malaysian afternoon. Rather than plumb a timezone through for a cosmetic
// line, these are simply time-agnostic and rotate on each load.
const GREETINGS = [
  "Welcome back.",
  "Here's where things stand.",
  "Your desk, at a glance.",
  "Everything in one place.",
  "Let's get you sorted.",
  "The books are open.",
  "All yours.",
  "Ready when you are.",
  "Here's the latest.",
  "Back to business.",
  "Let's take a look.",
  "Nothing slips through here.",
  "Your numbers, up to date.",
  "Straight to the point.",
  "Here's what matters today.",
  "Good to see you.",
  "The floor is yours.",
  "Let's keep things moving.",
  "Everything's accounted for.",
  "Your back office, handled.",
  "Fresh off the books.",
  "Let's make it count.",
  "All caught up here.",
  "Here's the shape of things.",
  "Steady as it goes.",
  "Your operation, in focus.",
  "Let's see where we are.",
  "Books balanced, mind clear.",
  "One place for all of it.",
  "Lily's been busy.",
];

export default function DashboardHero({
  pending,
  marginThisMonth,
  salesThisMonth,
  cascade,
  tenantName,
}: {
  pending: number;
  marginThisMonth: number;
  salesThisMonth: number;
  /** Margin talk only makes sense for a cascade group — everyone else hears revenue. */
  cascade: boolean;
  tenantName: string;
}) {
  // Server component, so this runs once per request — no hydration mismatch,
  // and you get a different line each time you land on the dashboard.
  const greetingText = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  const moneyLine = cascade
    ? `RM ${fmt2(marginThisMonth)} in margin captured this month`
    : `RM ${fmt2(salesThisMonth)} invoiced this month`;
  const sub =
    pending > 0
      ? `${pending} order${pending > 1 ? "s" : ""} ${pending > 1 ? "are" : "is"} waiting on your review, and ${moneyLine}.`
      : `Nothing waiting on you right now — ${moneyLine}.`;

  return (
    <div className="relative rounded-2xl border border-line overflow-hidden p-7 sm:p-9 isolate">
      <BorderBeam size={260} duration={16} />
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
        {tenantName} · live
      </div>
      <h1 className="mt-2.5 text-[26px] sm:text-[30px] font-semibold tracking-tight text-ink max-w-lg leading-tight">
        {greetingText}
      </h1>
      <p className="mt-2 text-[14.5px] text-muted max-w-md leading-relaxed">{sub}</p>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Link
          href="/pending"
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
