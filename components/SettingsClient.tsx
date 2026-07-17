"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Company, Product, MarginRule, MarginType } from "@/lib/types";
import { Card } from "@/components/ui";
import { IconCheck, IconPencil } from "@/components/icons";
import { deriveUpstreamPrice } from "@/lib/cascade";

function fmt(n: number) {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const SHORT: Record<string, string> = { tien_ngai: "Tien Ngai", prim: "Prim", "3c": "3C" };
const ACCENT: Record<string, string> = {
  tien_ngai: "bg-blue-50 text-blue-700 ring-blue-200",
  prim: "bg-amber-50 text-amber-700 ring-amber-200",
  "3c": "bg-violet-50 text-violet-700 ring-violet-200",
};
const TEXT: Record<string, string> = {
  tien_ngai: "text-blue-700",
  prim: "text-amber-700",
  "3c": "text-violet-700",
};

export default function SettingsClient({
  companies, // ordered origin -> ... -> customer-facing (CHAIN order)
  products,
  rules: initialRules,
}: {
  companies: Company[];
  products: Product[];
  rules: MarginRule[];
}) {
  const [rules, setRules] = useState(initialRules);
  const origin = companies[0];

  // Margins are POSITIONAL — layer 1 = customer-facing, layer 2 = inner/middle.
  // Whichever company sits in that slot for a given transaction uses that rate.
  const LAYERS = [
    { layer: 1, label: "Layer 1 — customer-facing", sub: "Applied by whichever company bills the customer directly" },
    { layer: 2, label: "Layer 2 — inner / middle",  sub: "Applied by whichever company is one step back from the customer" },
  ];

  function rule(productId: string, layer: number) {
    return rules.find((r) => r.productId === productId && r.layer === layer);
  }
  async function saveRule(productId: string, layer: number, patch: Partial<MarginRule>) {
    const current = rule(productId, layer) ?? { productId, layer, type: "rm_per_unit" as MarginType, value: 0 };
    const next = { ...current, ...patch } as MarginRule;
    setRules((rs) => [...rs.filter((r) => !(r.productId === productId && r.layer === layer)), next]);
    const res = await fetch("/api/margins", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      // roll back the optimistic update
      setRules((rs) => [...rs.filter((r) => !(r.productId === productId && r.layer === layer)), current]);
      alert("Couldn't save that margin — please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Pricing & margins">
        <p className="text-[13px] text-muted -mt-1 mb-4">
          Margins are <strong>positional</strong> — they belong to the layer, not any specific company.
          You enter only the customer sell price; Lily back-calculates every upstream price using these layers.
        </p>

        <div className="grid lg:grid-cols-2 gap-5">
          {LAYERS.map(({ layer, label, sub }) => (
            <MarginCompany
              key={layer}
              title={label}
              subtitle={sub}
              accent={layer === 1 ? "bg-violet-50 text-violet-700 ring-violet-200" : "bg-amber-50 text-amber-700 ring-amber-200"}
              products={products}
              layer={layer}
              getRule={rule}
              onSave={saveRule}
            />
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-canvas border border-line p-3 text-[12px] text-muted">
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 mr-2 text-[11px] font-medium ring-1 ring-inset ${ACCENT[origin.key]}`}>
            {origin.name}
          </span>
          Origin of the chain — issues at the derived base price (no margin to set here).
        </div>

        <CascadePreview companies={companies} products={products} getRule={rule} />
      </Card>

      <div className="grid lg:grid-cols-3 gap-5">
        {companies.map((c) => (
          <CompanyEditor key={c.key} company={c} />
        ))}
      </div>
    </div>
  );
}

function MarginCompany({
  title,
  subtitle,
  accent,
  products,
  layer,
  getRule,
  onSave,
}: {
  title: string;
  subtitle: string;
  accent: string;
  products: Product[];
  layer: number;
  getRule: (p: string, l: number) => MarginRule | undefined;
  onSave: (p: string, l: number, patch: Partial<MarginRule>) => void;
}) {
  return (
    <div className="rounded-xl border border-line overflow-hidden">
      <div className="px-4 py-3 border-b border-line flex items-center gap-2">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${accent}`}>
          {title}
        </span>
        <span className="text-[12px] text-muted">{subtitle}</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {products.map((p) => {
            const r = getRule(p.id, layer);
            const type = r?.type ?? "rm_per_unit";
            const value = r?.value ?? 0;
            return (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  <div className="text-[13px] text-ink">{p.name}</div>
                  <div className="text-[11px] text-faint">per {p.uom.toLowerCase()}</div>
                </td>
                <td className="px-4 py-2.5 w-44">
                  <div className="flex items-center gap-1.5 justify-end">
                    {type === "rm_per_unit" && <span className="text-[12px] text-faint">RM</span>}
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={value}
                      onBlur={(e) => onSave(p.id, layer, { value: Number(e.target.value), type })}
                      className="w-20 border border-line rounded-lg px-2 py-1.5 text-sm tnum text-right focus:border-primary"
                    />
                    <select
                      value={type}
                      onChange={(e) => onSave(p.id, layer, { type: e.target.value as MarginType, value })}
                      className="border border-line rounded-lg px-1.5 py-1.5 text-[12px] focus:border-primary"
                    >
                      <option value="rm_per_unit">RM</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CascadePreview({
  companies,
  products,
  getRule,
}: {
  companies: Company[];
  products: Product[];
  getRule: (p: string, l: number) => MarginRule | undefined;
}) {
  const [pid, setPid] = useState(products[0]?.id ?? "");
  const [sell, setSell] = useState(8);
  const last = companies.length - 1;

  // selling price per company, walked back from customer-facing price using layer margins
  const price: Record<string, number> = {};
  price[companies[last].key] = sell;
  for (let i = last; i > 0; i--) {
    const depth = last - i + 1; // depth 1 = customer-facing (companies[last]), 2 = next up, …
    price[companies[i - 1].key] = deriveUpstreamPrice(price[companies[i].key], getRule(pid, depth));
  }
  const rows = companies.map((c, i) => ({
    who: `${SHORT[c.key]} → ${i < last ? SHORT[companies[i + 1].key] : "Customer"}`,
    price: price[c.key],
    cls: TEXT[c.key],
  }));
  const groupMargin = sell - price[companies[0].key];

  return (
    <div className="mt-5 rounded-xl border border-line p-4 bg-canvas/60">
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="text-[13px] font-medium text-ink mr-auto">Live cascade preview (per unit)</div>
        <select
          value={pid}
          onChange={(e) => setPid(e.target.value)}
          className="border border-line rounded-lg px-2.5 py-1.5 text-[13px] bg-surface focus:border-primary"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="text-[13px] flex items-center gap-2">
          <span className="text-faint">Sell RM</span>
          <input
            type="number"
            step="0.01"
            value={sell}
            onChange={(e) => setSell(Number(e.target.value))}
            className="w-24 border border-line rounded-lg px-2.5 py-1.5 text-sm tnum focus:border-primary"
          />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {rows.map((r) => (
          <div key={r.who} className="rounded-lg bg-surface border border-line px-3 py-2.5">
            <div className={`text-[12px] font-medium ${r.cls}`}>{r.who}</div>
            <div className="text-lg font-semibold tnum mt-0.5">RM {fmt(r.price)}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[12px] text-profit font-medium">Group margin per unit: RM {fmt(groupMargin)}</div>
    </div>
  );
}

function CompanyEditor({ company }: { company: Company }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: company.name,
    regNo: company.regNo,
    tinNo: company.tinNo ?? "",
    addressLines: company.addressLines.join("\n"),
    tel: company.tel,
    email: company.email,
    banks: company.banks.map((b) => `${b.bank} | ${b.account}`).join("\n"),
  });

  async function save() {
    setSaving(true);
    await fetch(`/api/companies/${company.key}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        regNo: form.regNo,
        tinNo: form.tinNo || undefined,
        addressLines: form.addressLines.split("\n").map((s) => s.trim()).filter(Boolean),
        tel: form.tel,
        email: form.email,
        banks: form.banks
          .split("\n")
          .map((l) => l.split("|").map((s) => s.trim()))
          .filter((p) => p[0])
          .map(([bank, account]) => ({ bank, account: account ?? "" })),
      }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <Card
      title={company.name}
      action={
        !editing ? (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:text-primary-hover"
          >
            <IconPencil size={14} /> Edit
          </button>
        ) : (
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-primary hover:bg-primary-hover text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
          >
            <IconCheck size={14} /> {saving ? "Saving…" : "Save"}
          </button>
        )
      }
    >
      {!editing ? (
        <div className="text-[13px] space-y-1 text-muted">
          <div>{company.regNo}</div>
          {company.tinNo && <div>TIN {company.tinNo}</div>}
          {company.addressLines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
          <div>{company.tel}</div>
          <div>{company.email}</div>
          <div className="pt-2 space-y-0.5">
            {company.banks.map((b, i) => (
              <div key={i} className="text-[12px]">
                <span className="text-ink font-medium">{b.bank}</span> — {b.account}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <Inp label="Name" v={form.name} on={(v) => setForm({ ...form, name: v })} />
          <div className="grid grid-cols-2 gap-2.5">
            <Inp label="Reg No" v={form.regNo} on={(v) => setForm({ ...form, regNo: v })} />
            <Inp label="TIN No" v={form.tinNo} on={(v) => setForm({ ...form, tinNo: v })} />
          </div>
          <Txt label="Address (one line each)" v={form.addressLines} on={(v) => setForm({ ...form, addressLines: v })} />
          <div className="grid grid-cols-2 gap-2.5">
            <Inp label="Tel" v={form.tel} on={(v) => setForm({ ...form, tel: v })} />
            <Inp label="Email" v={form.email} on={(v) => setForm({ ...form, email: v })} />
          </div>
          <Txt label="Banks (Bank | Account)" v={form.banks} on={(v) => setForm({ ...form, banks: v })} />
        </div>
      )}
    </Card>
  );
}

function Inp({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-faint mb-1">{label}</span>
      <input value={v} onChange={(e) => on(e.target.value)} className="w-full border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary" />
    </label>
  );
}
function Txt({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-faint mb-1">{label}</span>
      <textarea value={v} onChange={(e) => on(e.target.value)} rows={3} className="w-full border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary resize-none" />
    </label>
  );
}
