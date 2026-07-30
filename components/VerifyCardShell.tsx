"use client";

import type { ReactNode } from "react";

/**
 * Shared chrome for anything sitting in the verification queue.
 *
 * Money-in (sales documents) and money-out (expenses) used to be rendered by
 * two unrelated components — one a compact row that opened a modal, the other
 * a full inline form — so the same screen showed the same kind of decision in
 * two different shapes. This is the single shell both now use: identical
 * header, field grid and footer, with only the FIELDS differing.
 */
export default function VerifyCardShell({
  id,
  source,
  confidence,
  rawMessage,
  notes,
  thumbnailUrl,
  accent,
  headline,
  amount,
  children,
  onReject,
  onAccept,
  rejectLabel,
  acceptLabel,
  busy,
}: {
  id: string;
  source: "telegram" | "manual";
  confidence?: number;
  rawMessage?: string;
  notes?: string;
  thumbnailUrl?: string;
  /** profit = money in, loss = money out. Only the accent dot differs. */
  accent: "profit" | "loss";
  headline: string;
  amount: string;
  children: ReactNode;
  onReject: () => void;
  onAccept: () => void;
  rejectLabel: string;
  acceptLabel: string;
  busy: "" | "accept" | "reject";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
      {/* Header — identical on both sides */}
      <div className="flex items-start gap-3">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="h-11 w-11 rounded-lg object-cover border border-line shrink-0" />
        ) : (
          <span
            className={`h-11 w-11 shrink-0 rounded-lg grid place-items-center text-[11px] font-semibold ${
              accent === "profit" ? "bg-profit-soft text-profit" : "bg-loss-soft text-loss"
            }`}
          >
            {accent === "profit" ? "IN" : "OUT"}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[11px] text-faint">{id}</span>
            <span className="text-[10px] rounded-full border border-line px-1.5 py-0.5 text-muted">
              {source === "telegram" ? "via Telegram" : "manual"}
            </span>
            {confidence !== undefined && (
              <span className="text-[10px] rounded-full border border-line px-1.5 py-0.5 text-muted">
                AI {Math.round(confidence * 100)}%
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[14px] font-medium text-ink truncate">{headline}</div>
          {rawMessage && (
            <p className="text-[12px] text-faint mt-0.5 line-clamp-2">&ldquo;{rawMessage}&rdquo;</p>
          )}
        </div>

        <div className="text-right shrink-0">
          <div className="tnum text-[15px] font-semibold text-ink">RM {amount}</div>
        </div>
      </div>

      {notes && <p className="text-[12px] text-warn">⚠ {notes}</p>}

      {/* Fields — the only part that differs between the two kinds */}
      <div className="grid grid-cols-2 gap-2">{children}</div>

      {/* Footer — identical on both sides */}
      <div className="flex gap-2 justify-end pt-0.5">
        <button
          onClick={onReject}
          disabled={!!busy}
          className="text-[13px] text-loss hover:bg-loss-soft rounded-lg px-3 py-1.5 disabled:opacity-60"
        >
          {busy === "reject" ? "Working…" : rejectLabel}
        </button>
        <button
          onClick={onAccept}
          disabled={!!busy}
          className="text-[13px] font-semibold bg-primary hover:bg-primary-hover text-white rounded-lg px-3.5 py-1.5 disabled:opacity-60"
        >
          {busy === "accept" ? "Working…" : acceptLabel}
        </button>
      </div>
    </div>
  );
}

/** Shared labelled input so both cards' fields line up pixel-for-pixel. */
export function VerifyField({
  label,
  v,
  on,
  wide,
  readOnly,
}: {
  label: string;
  v: string;
  on?: (v: string) => void;
  wide?: boolean;
  readOnly?: boolean;
}) {
  return (
    <label className={`block ${wide ? "col-span-2" : ""}`}>
      <span className="block text-[11px] uppercase tracking-wide text-faint mb-1">{label}</span>
      <input
        value={v}
        readOnly={readOnly}
        onChange={(e) => on?.(e.target.value)}
        className={`w-full border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary ${
          readOnly ? "bg-canvas text-muted" : ""
        }`}
      />
    </label>
  );
}
