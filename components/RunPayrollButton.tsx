"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function RunPayrollButton({ hasEmployees }: { hasEmployees: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(currentMonth());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/payroll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok) {
      router.push(`/payroll/${data.run.id}`);
    } else {
      setError(data?.error || "Couldn't run payroll — please try again.");
    }
  }

  if (!hasEmployees) {
    return (
      <span className="text-[13px] text-faint" title="Add employees in Settings first">
        Add employees in Settings first
      </span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-[13px] font-medium px-3.5 py-2"
      >
        <span className="text-base leading-none">+</span> Run payroll
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="border border-line rounded-lg px-2.5 py-1.5 text-[13px]"
      />
      {error && <span className="text-[12px] text-loss">{error}</span>}
      <button
        onClick={() => setOpen(false)}
        disabled={busy}
        className="text-[13px] text-muted hover:bg-canvas rounded-lg px-3 py-1.5"
      >
        Cancel
      </button>
      <button
        onClick={run}
        disabled={busy}
        className="text-[13px] font-semibold bg-primary hover:bg-primary-hover text-white rounded-lg px-3.5 py-1.5 disabled:opacity-60"
      >
        {busy ? "Running…" : "Run"}
      </button>
    </div>
  );
}
