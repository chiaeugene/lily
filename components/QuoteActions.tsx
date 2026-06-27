"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPrinter, IconCheck, IconArrowRight, IconShare } from "@/components/icons";

export default function QuoteActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(status === "accepted");

  async function send() {
    setSending(true);
    try {
      const res = await fetch(`/api/quotation/${id}/pdf`);
      const filename = `${id}.pdf`;
      if ((res.headers.get("content-type") ?? "").includes("application/pdf")) {
        const blob = await res.blob();
        const file = new File([blob], filename, { type: "application/pdf" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: id });
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }
      window.open(`/api/quotation/${id}/pdf`, "_blank");
    } catch {
      // share cancelled
    } finally {
      setSending(false);
    }
  }

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
        href={`/api/quotation/${id}/pdf`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white text-ink text-[13px] font-medium px-3.5 py-2 hover:bg-slate-50"
      >
        <IconPrinter size={16} /> Print
      </a>
      <button
        onClick={send}
        disabled={sending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white text-ink text-[13px] font-medium px-3.5 py-2 hover:bg-slate-50 disabled:opacity-60"
      >
        <IconShare size={16} /> {sending ? "Preparing…" : "Send PDF"}
      </button>
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
