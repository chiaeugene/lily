"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JourneySearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function go() {
    if (!q.trim()) return;
    router.push(`/journey/${encodeURIComponent(q.trim())}`);
  }

  return (
    <div className="flex gap-2 max-w-lg">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        placeholder="Paste a Quotation, PO, Order, or Transaction ID — e.g. QT-2607-001"
        className="flex-1 border border-line rounded-lg px-3 py-2 text-sm focus:border-primary"
      />
      <button
        onClick={go}
        className="rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium px-4 py-2"
      >
        Track
      </button>
    </div>
  );
}
