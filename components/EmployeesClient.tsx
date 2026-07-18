"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Employee } from "@/lib/types";
import { Card } from "@/components/ui";
import { fmt2 } from "@/lib/money";
import { IconPencil } from "@/components/icons";

const BLANK = { name: "", position: "", icNo: "", bankName: "", bankAccount: "", epfNo: "", socsoNo: "", basicSalary: "" };
type Form = typeof BLANK;

function toForm(e: Employee): Form {
  return {
    name: e.name,
    position: e.position ?? "",
    icNo: e.icNo ?? "",
    bankName: e.bankName ?? "",
    bankAccount: e.bankAccount ?? "",
    epfNo: e.epfNo ?? "",
    socsoNo: e.socsoNo ?? "",
    basicSalary: String(e.basicSalary),
  };
}

export default function EmployeesClient({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, basicSalary: Number(form.basicSalary) || 0 }),
    });
    setBusy(false);
    if (res.ok) {
      setAdding(false);
      setForm(BLANK);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Couldn't add employee");
    }
  }

  async function toggle(id: string, active: boolean) {
    await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active }),
    });
    router.refresh();
  }

  return (
    <Card
      title={`Employees · ${employees.filter((e) => e.active).length}`}
      action={
        !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-[13px] font-medium text-primary hover:text-primary-hover"
          >
            + Add employee
          </button>
        )
      }
    >
      <div className="space-y-2">
        {adding && (
          <EmployeeForm
            form={form}
            setForm={setForm}
            busy={busy}
            error={error}
            onCancel={() => { setAdding(false); setError(""); setForm(BLANK); }}
            onSave={add}
            saveLabel="Add"
          />
        )}

        {employees.length === 0 && !adding && (
          <p className="text-sm text-muted py-4 text-center">No employees yet — add your first.</p>
        )}

        {employees.map((e) => (
          <EmployeeRow key={e.id} employee={e} onToggle={toggle} />
        ))}
      </div>
    </Card>
  );
}

function EmployeeRow({ employee: e, onToggle }: { employee: Employee; onToggle: (id: string, active: boolean) => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(toForm(e));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, id: e.id, active: e.active, basicSalary: Number(form.basicSalary) || 0 }),
    });
    setBusy(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Couldn't save changes");
    }
  }

  if (editing) {
    return (
      <EmployeeForm
        form={form}
        setForm={setForm}
        busy={busy}
        error={error}
        onCancel={() => { setEditing(false); setForm(toForm(e)); setError(""); }}
        onSave={save}
        saveLabel="Save"
      />
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className={`text-[13px] font-medium ${e.active ? "text-ink" : "text-faint line-through"}`}>
          {e.name}{e.position ? ` · ${e.position}` : ""}
        </div>
        <div className="text-[12px] text-faint">
          RM {fmt2(e.basicSalary)}/month{e.epfNo ? ` · EPF ${e.epfNo}` : ""}{e.socsoNo ? ` · SOCSO ${e.socsoNo}` : ""}
        </div>
      </div>
      <button onClick={() => setEditing(true)} className="text-muted hover:text-primary p-1" aria-label="Edit">
        <IconPencil size={15} />
      </button>
      <button
        onClick={() => onToggle(e.id, !e.active)}
        className={`text-[12px] font-medium rounded-lg px-3 py-1.5 ${
          e.active ? "text-loss hover:bg-loss-soft" : "text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100"
        }`}
      >
        {e.active ? "Deactivate" : "Reactivate"}
      </button>
    </div>
  );
}

function EmployeeForm({
  form,
  setForm,
  busy,
  error,
  onCancel,
  onSave,
  saveLabel,
}: {
  form: Form;
  setForm: (f: Form) => void;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <div className="rounded-lg border border-line px-3 py-2.5 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="border border-line rounded-lg px-3 py-1.5 text-sm focus:border-primary" />
        <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Position" className="border border-line rounded-lg px-3 py-1.5 text-sm focus:border-primary" />
        <input value={form.icNo} onChange={(e) => setForm({ ...form, icNo: e.target.value })} placeholder="IC number" className="border border-line rounded-lg px-3 py-1.5 text-sm focus:border-primary" />
        <input value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="Basic salary (RM)" inputMode="decimal" className="border border-line rounded-lg px-3 py-1.5 text-sm focus:border-primary" />
        <input value={form.epfNo} onChange={(e) => setForm({ ...form, epfNo: e.target.value })} placeholder="EPF number" className="border border-line rounded-lg px-3 py-1.5 text-sm focus:border-primary" />
        <input value={form.socsoNo} onChange={(e) => setForm({ ...form, socsoNo: e.target.value })} placeholder="SOCSO number" className="border border-line rounded-lg px-3 py-1.5 text-sm focus:border-primary" />
        <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="Bank name" className="border border-line rounded-lg px-3 py-1.5 text-sm focus:border-primary" />
        <input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} placeholder="Bank account" className="border border-line rounded-lg px-3 py-1.5 text-sm focus:border-primary" />
      </div>
      {error && <p className="text-[12px] text-loss">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} disabled={busy} className="text-[13px] text-muted hover:bg-canvas rounded-lg px-3 py-1.5">
          Cancel
        </button>
        <button onClick={onSave} disabled={busy || !form.name.trim()} className="text-[13px] font-semibold bg-primary hover:bg-primary-hover text-white rounded-lg px-3 py-1.5 disabled:opacity-60">
          {busy ? "Saving…" : saveLabel}
        </button>
      </div>
    </div>
  );
}
