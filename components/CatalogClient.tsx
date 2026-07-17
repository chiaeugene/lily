"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer, Product } from "@/lib/types";
import { Card } from "@/components/ui";
import { IconPencil, IconCheck, IconX, IconShare } from "@/components/icons";

export default function CatalogClient({
  customers,
  products,
}: {
  customers: Customer[];
  products: Product[];
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <CustomersCard customers={customers} />
      <ProductsCard products={products} />
    </div>
  );
}

// ── Customers ─────────────────────────────────────────────────────────────────
function CustomersCard({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <Card
      title={`Customers · ${customers.length}`}
      action={
        !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-[13px] font-medium text-primary hover:text-primary-hover"
          >
            + Add customer
          </button>
        )
      }
    >
      <div className="space-y-2">
        {adding && (
          <CustomerRow
            customer={{ id: "", name: "", addressLines: [], tel: "" }}
            startEditing
            onDone={() => {
              setAdding(false);
              router.refresh();
            }}
          />
        )}
        {customers.length === 0 && !adding && (
          <p className="text-sm text-muted py-4 text-center">No customers yet — add your first.</p>
        )}
        {customers.map((c) => (
          <CustomerRow key={c.id} customer={c} onDone={() => router.refresh()} />
        ))}
      </div>
    </Card>
  );
}

function CustomerRow({
  customer,
  startEditing = false,
  onDone,
}: {
  customer: Customer;
  startEditing?: boolean;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(customer.name);
  const [address, setAddress] = useState(customer.addressLines.join("\n"));
  const [tel, setTel] = useState(customer.tel ?? "");

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    await fetch("/api/customers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: customer.id || undefined,
        name,
        addressLines: address.split("\n").map((s) => s.trim()).filter(Boolean),
        tel: tel || undefined,
      }),
    });
    setBusy(false);
    setEditing(false);
    onDone();
  }
  async function remove() {
    if (!confirm(`Delete customer "${customer.name}"?`)) return;
    setBusy(true);
    await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
    setBusy(false);
    onDone();
  }
  async function copyPortalLink() {
    const res = await fetch(`/api/customers/${customer.id}/portal-link`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.token) {
      alert("Couldn't create a portal link — please try again.");
      return;
    }
    const url = `${window.location.origin}/client/${data.token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    alert(`Portal link copied:\n${url}`);
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-ink">{customer.name}</div>
          {customer.addressLines.length > 0 && (
            <div className="text-[12px] text-faint">{customer.addressLines.join(", ")}</div>
          )}
          {customer.tel && <div className="text-[12px] text-faint">Tel: {customer.tel}</div>}
        </div>
        <button onClick={copyPortalLink} className="text-muted hover:text-primary p-1" aria-label="Copy portal link" title="Copy this customer's portal link">
          <IconShare size={15} />
        </button>
        <button onClick={() => setEditing(true)} className="text-muted hover:text-primary p-1" aria-label="Edit">
          <IconPencil size={15} />
        </button>
        <button onClick={remove} disabled={busy} className="text-muted hover:text-loss p-1" aria-label="Delete">
          <IconX size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-primary-soft/30 px-3 py-3 space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Customer name"
        className="w-full border border-line rounded-lg px-2.5 py-1.5 text-sm focus:border-primary"
      />
      <textarea
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Address (one line each)"
        rows={2}
        className="w-full border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary resize-none"
      />
      <input
        value={tel}
        onChange={(e) => setTel(e.target.value)}
        placeholder="Tel"
        className="w-full border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={() => setEditing(false)} className="text-[13px] text-muted hover:bg-canvas rounded-lg px-2.5 py-1.5">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-primary hover:bg-primary-hover text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
        >
          <IconCheck size={14} /> {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Products ──────────────────────────────────────────────────────────────────
function ProductsCard({ products }: { products: Product[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <Card
      title={`Products · ${products.length}`}
      action={
        !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-[13px] font-medium text-primary hover:text-primary-hover"
          >
            + Add product
          </button>
        )
      }
    >
      <div className="space-y-2">
        {adding && (
          <ProductRow
            product={{ id: "", name: "", specLines: [], uom: "KGS" }}
            startEditing
            onDone={() => {
              setAdding(false);
              router.refresh();
            }}
          />
        )}
        {products.length === 0 && !adding && (
          <p className="text-sm text-muted py-4 text-center">No products yet — add your first.</p>
        )}
        {products.map((p) => (
          <ProductRow key={p.id} product={p} onDone={() => router.refresh()} />
        ))}
      </div>
      <p className="mt-3 text-[12px] text-faint">
        New products start with no margin — set the per-tier margin in Pricing &amp; margins above.
      </p>
    </Card>
  );
}

function ProductRow({
  product,
  startEditing = false,
  onDone,
}: {
  product: Product;
  startEditing?: boolean;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(product.name);
  const [specs, setSpecs] = useState(product.specLines.join("\n"));
  const [uom, setUom] = useState(product.uom);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    await fetch("/api/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: product.id || undefined,
        name,
        specLines: specs.split("\n").map((s) => s.trim()).filter(Boolean),
        uom,
      }),
    });
    setBusy(false);
    setEditing(false);
    onDone();
  }
  async function remove() {
    if (!confirm(`Delete product "${product.name}"? Its margin rules will be removed too.`)) return;
    setBusy(true);
    await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    setBusy(false);
    onDone();
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-ink">{product.name}</div>
          <div className="text-[12px] text-faint">
            {product.uom}
            {product.specLines.length > 0 ? ` · ${product.specLines.join(" / ")}` : ""}
          </div>
        </div>
        <button onClick={() => setEditing(true)} className="text-muted hover:text-primary p-1" aria-label="Edit">
          <IconPencil size={15} />
        </button>
        <button onClick={remove} disabled={busy} className="text-muted hover:text-loss p-1" aria-label="Delete">
          <IconX size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-primary-soft/30 px-3 py-3 space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Product name"
        className="w-full border border-line rounded-lg px-2.5 py-1.5 text-sm focus:border-primary"
      />
      <div className="flex gap-2">
        <textarea
          value={specs}
          onChange={(e) => setSpecs(e.target.value)}
          placeholder="Spec lines (one each)"
          rows={2}
          className="flex-1 border border-line rounded-lg px-2.5 py-1.5 text-[13px] focus:border-primary resize-none"
        />
        <select
          value={uom}
          onChange={(e) => setUom(e.target.value)}
          className="border border-line rounded-lg px-2 py-1.5 text-[13px] focus:border-primary self-start"
        >
          <option value="KGS">KGS</option>
          <option value="BOXES">BOXES</option>
          <option value="ROLLS">ROLLS</option>
          <option value="PCS">PCS</option>
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setEditing(false)} className="text-[13px] text-muted hover:bg-canvas rounded-lg px-2.5 py-1.5">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-primary hover:bg-primary-hover text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
        >
          <IconCheck size={14} /> {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
