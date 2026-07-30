"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Tenant } from "@/lib/tenant";
import { IconChevron } from "@/components/icons";

/**
 * Company switcher — rendered only for the platform admin. Everyone else is
 * pinned to their own company and never sees this control.
 *
 * The UI hiding is convenience, not the security boundary: /api/tenants/switch
 * rejects non-super-admins, and getSession() ignores the tenant cookie for any
 * other role, so forging it gets you nothing.
 */
export default function TenantSwitcher({
  tenants,
  currentId,
}: {
  tenants: Tenant[];
  currentId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = tenants.find((t) => t.id === currentId);

  async function switchTo(id: string) {
    if (id === currentId) return setOpen(false);
    setBusy(true);
    const res = await fetch("/api/tenants/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: id }),
    });
    setBusy(false);
    setOpen(false);
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      toast.error(d?.error || "Couldn't switch company.");
      return;
    }
    const t = tenants.find((x) => x.id === id);
    toast.success(`Now viewing ${t?.name ?? id}`);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="w-full flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2
          text-left hover:border-primary/40 hover:bg-canvas transition-colors disabled:opacity-60"
      >
        <span className="h-6 w-6 shrink-0 rounded-md bg-primary-soft text-primary-hover grid place-items-center text-[11px] font-semibold">
          {(current?.name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium text-ink">{current?.name ?? "Select company"}</span>
          <span className="block text-[10px] text-faint">Platform admin · switch</span>
        </span>
        <IconChevron size={13} className={`text-faint shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute bottom-full left-0 right-0 z-40 mb-1.5 rounded-lg border border-line bg-surface shadow-pop overflow-hidden max-h-64 overflow-y-auto">
            {tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => switchTo(t.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 text-left text-[12px] hover:bg-canvas
                  ${t.id === currentId ? "bg-primary-soft/60 text-primary-hover font-medium" : "text-ink"}`}
              >
                <span className="h-5 w-5 shrink-0 rounded bg-surface-2 grid place-items-center text-[10px] font-semibold text-muted">
                  {t.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                {t.cascadeEnabled && (
                  <span className="shrink-0 text-[9px] uppercase tracking-wide text-faint">cascade</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
