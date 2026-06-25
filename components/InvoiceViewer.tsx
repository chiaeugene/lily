"use client";

import { useEffect } from "react";
import { CompanyBadge } from "@/components/ui";
import { IconX, IconPrinter, IconDownload } from "@/components/icons";
import { fmt2 } from "@/lib/money";

export interface InvoiceRef {
  id: string;
  company: string;
  invoiceNo: string;
  finalTotal: number;
}

export default function InvoiceViewer({ invoice, onClose }: { invoice: InvoiceRef | null; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (invoice) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [invoice, onClose]);

  if (!invoice) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-pop w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden">

        {/* Header — compact on mobile */}
        <div className="flex items-center justify-between px-3 sm:px-5 h-14 border-b border-line gap-2 min-w-0">
          {/* Invoice identity */}
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <CompanyBadge company={invoice.company} />
            <span className="font-medium text-sm tnum truncate">{invoice.invoiceNo}</span>
            <span className="text-muted text-sm tnum hidden sm:inline shrink-0">· RM {fmt2(invoice.finalTotal)}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={`/api/invoice/${invoice.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-ink hover:bg-canvas rounded-lg px-2 sm:px-3 py-1.5 whitespace-nowrap"
              title="Print / Send"
            >
              <IconPrinter size={16} />
              <span className="hidden sm:inline">Print / Send</span>
            </a>
            <a
              href={`/api/invoice/${invoice.id}`}
              target="_blank"
              rel="noreferrer"
              download
              className="inline-flex items-center gap-1.5 text-sm text-ink hover:bg-canvas rounded-lg px-2 sm:px-3 py-1.5 whitespace-nowrap"
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

        {/* Invoice preview — viewport meta in the HTML auto-scales to fit */}
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
