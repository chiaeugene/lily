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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-pop w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 h-14 border-b border-line">
          <div className="flex items-center gap-2.5">
            <CompanyBadge company={invoice.company} />
            <span className="font-medium text-sm tnum">{invoice.invoiceNo}</span>
            <span className="text-muted text-sm tnum">· RM {fmt2(invoice.finalTotal)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href={`/api/invoice/${invoice.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-ink hover:bg-canvas rounded-lg px-3 py-1.5"
            >
              <IconPrinter size={16} /> Print
            </a>
            <a
              href={`/api/invoice/${invoice.id}`}
              target="_blank"
              rel="noreferrer"
              download
              className="inline-flex items-center gap-1.5 text-sm text-ink hover:bg-canvas rounded-lg px-3 py-1.5"
            >
              <IconDownload size={16} /> Export
            </a>
            <button onClick={onClose} aria-label="Close" className="text-muted hover:bg-canvas rounded-lg p-2">
              <IconX size={18} />
            </button>
          </div>
        </div>
        <iframe src={`/api/invoice/${invoice.id}`} title={invoice.invoiceNo} className="flex-1 w-full bg-white min-h-[60vh]" />
      </div>
    </div>
  );
}
