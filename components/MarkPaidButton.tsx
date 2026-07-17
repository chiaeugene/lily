"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@/components/icons";

export default function MarkPaidButton({ transactionId, paid }: { transactionId: string; paid: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/transaction/${transactionId}/paid`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paid: !paid }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Couldn't update payment status — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (paid) {
    return (
      <button
        onClick={toggle}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg px-3 py-2 disabled:opacity-60"
      >
        <IconCheck size={16} /> {busy ? "Updating…" : "Paid"}
      </button>
    );
  }
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-ink border border-line hover:bg-canvas rounded-lg px-3 py-2 disabled:opacity-60"
    >
      <IconCheck size={16} /> {busy ? "Updating…" : "Mark paid"}
    </button>
  );
}
