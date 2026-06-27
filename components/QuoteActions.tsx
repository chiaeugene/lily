"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPrinter, IconCheck, IconArrowRight } from "@/components/icons";

export default function QuoteActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(status === "accepted");

  async function accept() {
    setBusy(true);
    const res = await fetch(`/api/quotation/${id}/convert`, { method: "POST" });
    if (res.ok) {
      setDone(true);
      // Land on the dashboard where the new pending order is waiting to verify.
      router.push("/dashboard");
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/api/quotation/${id}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white text-ink text-[13px] font-medium px-3.5 py-2 hover:bg-slate-50"
      >
        <IconPrinter size={16} /> Print / Send
      </a>
      {done ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[13px] font-medium px-3.5 py-2">
          <IconCheck size={16} /> Accepted — order created
        </span>
      ) : (
        <button
          onClick={accept}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold px-3.5 py-2 disabled:opacity-60"
        >
          {busy ? "Accepting…" : <>Accept → create order <IconArrowRight size={15} /></>}
        </button>
      )}
    </div>
  );
}
