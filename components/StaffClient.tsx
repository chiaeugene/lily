"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Staff } from "@/lib/staff";
import { Card } from "@/components/ui";

export default function StaffClient({ staff }: { staff: Staff[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, passcode }),
    });
    setBusy(false);
    if (res.ok) {
      setAdding(false);
      setName("");
      setPasscode("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Couldn't add staff member");
    }
  }

  async function toggle(id: string, active: boolean) {
    await fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active }),
    });
    router.refresh();
  }

  return (
    <Card
      title={`Staff · ${staff.filter((s) => s.active).length}`}
      action={
        !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-[13px] font-medium text-primary hover:text-primary-hover"
          >
            + Add staff
          </button>
        )
      }
    >
      <p className="text-[13px] text-muted -mt-1 mb-4">
        Each person gets their own passcode so actions (verify, void, mark paid…) are attributed by name in the
        records, instead of a single shared login.
      </p>

      <div className="space-y-2">
        {adding && (
          <div className="rounded-lg border border-line px-3 py-2.5 space-y-2">
            <div className="flex gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="flex-1 border border-line rounded-lg px-3 py-1.5 text-sm focus:border-primary"
              />
              <input
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ""))}
                placeholder="Passcode (4-8 digits)"
                inputMode="numeric"
                className="w-44 border border-line rounded-lg px-3 py-1.5 text-sm focus:border-primary"
              />
            </div>
            {error && <p className="text-[12px] text-loss">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setAdding(false); setError(""); }}
                disabled={busy}
                className="text-[13px] text-muted hover:bg-canvas rounded-lg px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={add}
                disabled={busy || !name.trim() || !passcode}
                className="text-[13px] font-semibold bg-primary hover:bg-primary-hover text-white rounded-lg px-3 py-1.5 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Add"}
              </button>
            </div>
          </div>
        )}

        {staff.length === 0 && !adding && (
          <p className="text-sm text-muted py-4 text-center">No staff yet — add your first.</p>
        )}

        {staff.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className={`text-[13px] font-medium ${s.active ? "text-ink" : "text-faint line-through"}`}>
                {s.name}
              </div>
              <div className="text-[12px] text-faint">Passcode {s.passcode}</div>
            </div>
            <button
              onClick={() => toggle(s.id, !s.active)}
              className={`text-[12px] font-medium rounded-lg px-3 py-1.5 ${
                s.active
                  ? "text-loss hover:bg-loss-soft"
                  : "text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              {s.active ? "Deactivate" : "Reactivate"}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
