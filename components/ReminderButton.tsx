"use client";

import { IconShare } from "@/components/icons";

function toWhatsAppNumber(tel: string): string | null {
  const digits = tel.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return `60${digits.slice(1)}`;
  return digits;
}

export default function ReminderButton({
  tel,
  customerName,
  invoiceNo,
  amount,
  dueDateStr,
  daysOverdue,
}: {
  tel?: string;
  customerName: string;
  invoiceNo: string;
  amount: string;
  dueDateStr?: string;
  daysOverdue: number;
}) {
  const number = tel ? toWhatsAppNumber(tel) : null;

  function send() {
    const overdueLine = daysOverdue > 0 ? ` It is currently ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue.` : "";
    const message =
      `Hi ${customerName}, this is a friendly reminder from Tien Ngai Machinery that invoice ${invoiceNo} ` +
      `for RM${amount}${dueDateStr ? ` (due ${dueDateStr})` : ""} is still outstanding.${overdueLine} ` +
      `Kindly arrange payment at your earliest convenience. Thank you!`;
    const url = number
      ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      onClick={send}
      title={number ? `Draft a WhatsApp reminder to ${tel}` : "No phone number on file — you can still copy the message"}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-ink border border-line hover:bg-canvas rounded-lg px-3 py-2"
    >
      <IconShare size={16} /> Remind
    </button>
  );
}
