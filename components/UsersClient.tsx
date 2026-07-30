"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/tenant";
import { Card } from "@/components/ui";

const BLANK = { name: "", email: "", password: "", role: "staff" };

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Platform admin",
  owner: "Owner",
  staff: "Staff",
};

export default function UsersClient({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (res.ok) {
      setAdding(false);
      setForm(BLANK);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Couldn't add user");
    }
  }

  async function toggle(id: string, active: boolean) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Couldn't update that user.");
      return;
    }
    router.refresh();
  }

  async function resetPassword(id: string, name: string) {
    const pw = prompt(`New password for ${name} (min 6 characters):`);
    if (!pw) return;
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json().catch(() => null);
    alert(res.ok ? "Password updated." : data?.error || "Couldn't update the password.");
  }

  return (
    <Card
      title={`Users · ${users.filter((u) => u.active).length}`}
      action={
        !adding && (
          <button onClick={() => setAdding(true)} className="text-[13px] font-medium text-primary hover:text-primary-hover">
            + Add user
          </button>
        )
      }
    >
      <p className="text-[13px] text-muted -mt-1 mb-4">
        Each person signs in with their own email and password. Actions (verify, void, mark paid…) are recorded
        against their name.
      </p>

      <div className="space-y-2">
        {adding && (
          <div className="rounded-lg border border-line px-3 py-2.5 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="border border-line rounded-lg px-3 py-1.5 text-sm focus:border-primary" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" className="border border-line rounded-lg px-3 py-1.5 text-sm focus:border-primary" />
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password" className="border border-line rounded-lg px-3 py-1.5 text-sm focus:border-primary" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="border border-line rounded-lg px-3 py-1.5 text-sm focus:border-primary">
                <option value="staff">Staff</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            {error && <p className="text-[12px] text-loss">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setAdding(false); setError(""); setForm(BLANK); }} disabled={busy} className="text-[13px] text-muted hover:bg-canvas rounded-lg px-3 py-1.5">
                Cancel
              </button>
              <button onClick={add} disabled={busy || !form.name.trim() || !form.email.trim() || form.password.length < 6} className="text-[13px] font-semibold bg-primary hover:bg-primary-hover text-white rounded-lg px-3 py-1.5 disabled:opacity-60">
                {busy ? "Saving…" : "Add"}
              </button>
            </div>
          </div>
        )}

        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className={`text-[13px] font-medium ${u.active ? "text-ink" : "text-faint line-through"}`}>
                {u.name}
                {u.id === currentUserId && <span className="ml-2 text-[11px] text-faint">(you)</span>}
              </div>
              <div className="text-[12px] text-faint">
                {u.email} · {ROLE_LABEL[u.role] ?? u.role}
                {u.mustChangePassword && <span className="text-warn"> · password change recommended</span>}
              </div>
            </div>
            <button onClick={() => resetPassword(u.id, u.name)} className="text-[12px] font-medium text-primary hover:text-primary-hover px-2 py-1.5">
              Reset password
            </button>
            {u.id !== currentUserId && (
              <button
                onClick={() => toggle(u.id, !u.active)}
                className={`text-[12px] font-medium rounded-lg px-3 py-1.5 ${
                  u.active ? "text-loss hover:bg-loss-soft" : "text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100"
                }`}
              >
                {u.active ? "Deactivate" : "Reactivate"}
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
