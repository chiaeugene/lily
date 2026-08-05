"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function MyinvoisSubmit({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status?: "submitted" | "valid" | "invalid";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await fetch(`/api/invoice/${invoiceId}/myinvois`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? data.detail ?? "e-Invoice submission failed");
    } else {
      toast.success("Submitted to LHDN MyInvois");
    }
    router.refresh();
  }

  if (status === "valid")
    return <span className="text-[12px] font-medium text-profit">LHDN ✓ validated</span>;
  if (status === "submitted")
    return <span className="text-[12px] font-medium text-primary">LHDN · submitted</span>;

  return (
    <span className="inline-flex items-center gap-2">
      {status === "invalid" && <span className="text-[12px] text-loss">LHDN rejected</span>}
      <button
        onClick={submit}
        disabled={busy}
        className="text-[12px] font-medium text-primary hover:underline disabled:opacity-50"
      >
        {busy ? "Submitting…" : status === "invalid" ? "Retry e-Invoice" : "Submit e-Invoice"}
      </button>
    </span>
  );
}
