"use client";

import { useEffect, useState } from "react";
import { CompanyBadge } from "@/components/ui";
import { IconX, IconPrinter, IconDownload, IconShare } from "@/components/icons";
import { fmt2 } from "@/lib/money";

export interface InvoiceRef {
  id: string;
  company: string;
  invoiceNo: string;
  finalTotal: number;
}

export default function InvoiceViewer({ invoice, onClose }: { invoice: InvoiceRef | null; onClose: () => void }) {
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (invoice) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [invoice, onClose]);

  async function handleShare() {
    if (!invoice) return;
    setSharing(true);
    try {
      const res = await fetch(`/api/invoice/${invoice.id}/pdf`);
      const contentType = res.headers.get("content-type") ?? "";
      const filename = `${invoice.invoiceNo}.pdf`;

      if (contentType.includes("application/pdf")) {
        const blob = await res.blob();
        const file = new File([blob], filename, { type: "application/pdf" });

        // Mobile: native share sheet WITH the actual PDF file (WhatsApp, Telegram, email…)
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: invoice.invoiceNo });
          return;
        }

        // Desktop / no file-share support: download the real PDF so it can be attached.
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

      // PDF unavailable (no Chromium) — open the printable document instead.
      window.open(`/api/invoice/${invoice.id}/pdf`, "_blank");
    } catch {
      // user cancelled the share sheet — silently ignore
    } finally {
      setSharing(false);
    }
  }

  if (!invoice) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-pop w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-5 h-14 border-b border-line gap-2 min-w-0">
          {/* Invoice identity */}
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <CompanyBadge company={invoice.company} />
            <span className="font-medium text-sm tnum truncate">{invoice.invoiceNo}</span>
            <span className="text-muted text-sm tnum hidden sm:inline shrink-0">· RM {fmt2(invoice.finalTotal)}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Print — opens PDF/HTML in new tab for browser print dialog */}
            <a
              href={`/api/invoice/${invoice.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-ink hover:bg-canvas rounded-lg px-2 sm:px-3 py-1.5"
              title="Print"
            >
              <IconPrinter size={16} />
              <span className="hidden sm:inline">Print</span>
            </a>

            {/* Share — sends actual PDF file via Web Share API (WhatsApp, Telegram, email…) */}
            <button
              onClick={handleShare}
              disabled={sharing}
              className="inline-flex items-center gap-1.5 text-sm text-ink hover:bg-canvas rounded-lg px-2 sm:px-3 py-1.5 disabled:opacity-50"
              title="Send / Share"
            >
              <IconShare size={16} />
              <span className="hidden sm:inline">{sharing ? "Preparing…" : "Send"}</span>
            </button>

            {/* Save — downloads the real PDF */}
            <a
              href={`/api/invoice/${invoice.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              download={`${invoice.invoiceNo}.pdf`}
              className="inline-flex items-center gap-1.5 text-sm text-ink hover:bg-canvas rounded-lg px-2 sm:px-3 py-1.5"
              title="Save"
            >
              <IconDownload size={16} />
              <span className="hidden sm:inline">Save</span>
            </a>

            <button onClick={onClose} aria-label="Close" className="text-muted hover:bg-canvas rounded-lg p-2">
              <IconX size={18} />
            </button>
          </div>
        </div>

        {/* Invoice preview */}
        <iframe
          src={`/api/invoice/${invoice.id}`}
          title={invoice.invoiceNo}
          className="flex-1 w-full bg-white border-0"
          style={{ minHeight: "60vh" }}
        />
      </div>
    </div>
  );
}
