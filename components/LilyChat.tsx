"use client";

import { useState } from "react";
import { LilyMark } from "@/components/Logo";
import { IconX } from "@/components/icons";

// UI shell only — there is no AI backend wired up yet. It says so honestly
// rather than faking a "smart" response, since this is a real tool people
// make real business decisions with.
export default function LilyChat() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Speak to Lily"
        className="no-print fixed right-6 bottom-6 z-30 flex items-center gap-2.5 pl-3 pr-4 h-14 rounded-full bg-surface border-2 border-primary text-primary-hover shadow-pop hover:-translate-y-0.5 hover:shadow-xl active:scale-95 transition-all"
      >
        <span className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-light to-primary text-white grid place-items-center shrink-0">
          <LilyMark size={18} mono />
        </span>
        <span className="text-[14px] font-semibold whitespace-nowrap">Ask Lily</span>
      </button>

      {open && (
        <div className="no-print fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Speak to Lily">
          <div className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="absolute right-5 top-5 bottom-5 w-full max-w-[400px] bg-surface border border-line rounded-2xl shadow-pop flex flex-col overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-line">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-light to-primary text-white grid place-items-center shrink-0">
                <LilyMark size={17} mono />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">Speak to Lily</div>
                <div className="text-[11px] text-warn flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-warn" /> AI backend not connected yet
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-faint hover:text-ink p-1.5 rounded-lg hover:bg-surface-2">
                <IconX size={17} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary-light to-primary text-white grid place-items-center shrink-0">
                  <LilyMark size={15} mono />
                </div>
                <div className="bg-surface-2 rounded-xl rounded-tl-sm px-3.5 py-2.5 text-[13px] leading-relaxed text-ink max-w-[88%]">
                  Hi — this panel is ready, but I&apos;m not hooked up to your real order and invoice data yet.
                  <br /><br />
                  When that&apos;s built, I&apos;ll be able to answer things like &ldquo;what&apos;s overdue&rdquo; or
                  &ldquo;summarize Goodwill Marketing&rdquo; by querying your live Supabase data directly through Claude
                  with tool-use — not guessing, not canned replies.
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-line">
              <div className="flex items-center gap-2 bg-surface-2 border border-line rounded-xl px-3 py-2.5 opacity-60 cursor-not-allowed">
                <span className="text-[13px] text-faint flex-1">Coming soon — ask about any order, customer, or trend…</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
