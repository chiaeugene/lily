"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconX } from "@/components/icons";

export default function VoidButton({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirmVoid() {
    setBusy(true);
    try {
      const res = await fetch(`/api/transaction/${transactionId}/void`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error();
      setOpen(false);
      router.refresh();
    } catch {
      alert("Couldn't void this transaction — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-loss hover:bg-loss-soft rounded-lg px-3 py-2"
      >
        <IconX size={16} /> Void
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => !busy && setOpen(false)} />
          <div className="relative bg-surface rounded-2xl shadow-pop w-full max-w-md p-5">
            <h3 className="font-semibold text-ink">Void this transaction?</h3>
            <p className="text-[13px] text-muted mt-1">
              All three invoices keep their numbers (no gap in the series) but get a <b>VOID</b> watermark and
              are removed from sales &amp; margin totals. This can&apos;t be undone from the app.
            </p>
            <label className="block mt-4">
              <span className="block text-[11px] uppercase tracking-wide text-faint mb-1">Reason</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. wrong price — replaced by INV-2606/009"
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:border-primary resize-none"
              />
            </label>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="text-sm text-muted hover:bg-canvas rounded-lg px-3 py-2"
              >
                Cancel
              </button>
              <button
                onClick={confirmVoid}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-sm font-semibold bg-loss hover:opacity-90 text-white rounded-lg px-4 py-2 disabled:opacity-50"
              >
                {busy ? "Voiding…" : "Void transaction"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
