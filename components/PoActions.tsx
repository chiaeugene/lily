"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPrinter, IconCheck, IconArrowRight, IconShare, IconX } from "@/components/icons";

export default function PoActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "confirm" | "cancel">("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(status === "confirmed");
  const [cancelled, setCancelled] = useState(status === "cancelled");

  async function send() {
    setSending(true);
    try {
      const res = await fetch(`/api/po/${id}/pdf`);
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
      window.open(`/api/po/${id}/pdf`, "_blank");
    } catch {
      // share cancelled
    } finally {
      setSending(false);
    }
  }

  async function confirm() {
    setBusy("confirm");
    const res = await fetch(`/api/po/${id}/confirm`, { method: "POST" });
    if (res.ok) {
      setDone(true);
      router.push("/dashboard");
      router.refresh();
    } else {
      setBusy("");
    }
  }

  async function cancel() {
    setBusy("cancel");
    const res = await fetch(`/api/po/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCancelled(true);
      router.refresh();
    } else {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/api/po/${id}/pdf`}
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
      {cancelled ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 text-[13px] font-medium px-3.5 py-2">
          <IconX size={16} /> Cancelled
        </span>
      ) : done ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[13px] font-medium px-3.5 py-2">
          <IconCheck size={16} /> Confirmed
        </span>
      ) : (
        <>
          <button
            onClick={confirm}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold px-3.5 py-2 disabled:opacity-60"
          >
            {busy === "confirm" ? "Confirming…" : <>Confirm PO <IconArrowRight size={15} /></>}
          </button>
          <button
            onClick={cancel}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-loss hover:bg-loss-soft rounded-lg px-3 py-2 disabled:opacity-60"
          >
            {busy === "cancel" ? "Cancelling…" : "Cancel"}
          </button>
        </>
      )}
    </div>
  );
}
