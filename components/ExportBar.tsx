"use client";

import { useState } from "react";
import { IconDownload } from "@/components/icons";

const COMPANY_OPTS = [
  { value: "all", label: "All companies" },
  { value: "tien_ngai", label: "Tien Ngai" },
  { value: "prim", label: "Prim Paper" },
  { value: "3c", label: "3C Industries" },
];

export default function ExportBar() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [company, setCompany] = useState("all");
  const [customer, setCustomer] = useState("");
  const [includeVoid, setIncludeVoid] = useState(false);

  function url(format: "csv" | "pdf") {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (company !== "all") p.set("company", company);
    if (customer.trim()) p.set("customer", customer.trim());
    if (includeVoid) p.set("includeVoid", "1");
    p.set("format", format);
    return `/api/export?${p.toString()}`;
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Labeled label="From">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="border border-line rounded-lg px-2.5 py-1.5 text-[13px] tnum focus:border-primary" />
      </Labeled>
      <Labeled label="To">
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="border border-line rounded-lg px-2.5 py-1.5 text-[13px] tnum focus:border-primary" />
      </Labeled>
      <Labeled label="Company">
        <select value={company} onChange={(e) => setCompany(e.target.value)}
          className="border border-line rounded-lg px-2.5 py-1.5 text-[13px] bg-surface focus:border-primary">
          {COMPANY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Labeled>
      <Labeled label="Customer">
        <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="any"
          className="border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary w-36" />
      </Labeled>
      <label className="flex items-center gap-2 text-[13px] text-ink pb-1.5 cursor-pointer">
        <input type="checkbox" checked={includeVoid} onChange={(e) => setIncludeVoid(e.target.checked)}
          className="rounded border-line" />
        Include void
      </label>
      <div className="flex gap-2 ml-auto">
        <a href={url("csv")} className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-line hover:bg-canvas rounded-lg px-3 py-2">
          <IconDownload size={15} /> CSV
        </a>
        <a href={url("pdf")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-primary hover:bg-primary-hover text-white rounded-lg px-3 py-2">
          <IconDownload size={15} /> PDF bundle
        </a>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-faint">{label}</span>
      {children}
    </label>
  );
}
