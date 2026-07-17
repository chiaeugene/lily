import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { CHAIN } from "@/lib/companies";
import { getCurrentActor } from "@/lib/staff";
import type { CompanyKey } from "@/lib/types";

const VALID_COMPANIES = new Set<string>(CHAIN);

// POST = apply any edits made during verification, then build invoices.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await repo.getOrder(id);
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Which companies to generate (validated; defaults to full chain).
  const rawCompanies: unknown = body.companies;
  const companies: CompanyKey[] | undefined =
    Array.isArray(rawCompanies) && rawCompanies.length > 0
      ? (rawCompanies.filter((c): c is CompanyKey => typeof c === "string" && VALID_COMPANIES.has(c)))
      : undefined;

  const yourRef: string | undefined =
    typeof body.yourRef === "string" && body.yourRef.trim() ? body.yourRef.trim() : undefined;

  // Manually-typed invoice numbers, keyed by company (validated).
  const rawOverrides: unknown = body.invoiceNoOverrides;
  let invoiceNoOverrides: Partial<Record<CompanyKey, string>> | undefined;
  if (rawOverrides && typeof rawOverrides === "object") {
    for (const [k, v] of Object.entries(rawOverrides as Record<string, unknown>)) {
      if (VALID_COMPANIES.has(k) && typeof v === "string" && v.trim()) {
        (invoiceNoOverrides ??= {})[k as CompanyKey] = v.trim();
      }
    }
  }

  const updates: { customerName?: string; date?: string; terms?: string; lines?: typeof order.lines } = {};

  if (typeof body.customerName === "string" && body.customerName.trim()) {
    updates.customerName = body.customerName.trim();
  }
  // accept an edited invoice date in dd/MM/yyyy form
  if (typeof body.date === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(body.date.trim())) {
    updates.date = body.date.trim();
  }
  if (typeof body.terms === "string" && body.terms.trim()) {
    updates.terms = body.terms.trim();
  }
  const termsDays: number | undefined = Number.isFinite(body.termsDays) && Number(body.termsDays) >= 0
    ? Number(body.termsDays)
    : undefined;
  if (Array.isArray(body.lines)) {
    updates.lines = order.lines.map((l, i) => {
      const edit = body.lines[i];
      if (!edit) return l;
      return {
        ...l,
        qty: Number.isFinite(edit.qty) ? Number(edit.qty) : l.qty,
        sellUnitPrice: Number.isFinite(edit.sellUnitPrice) ? Number(edit.sellUnitPrice) : l.sellUnitPrice,
      };
    });
  }

  if (Object.keys(updates).length) {
    await repo.patchOrder(id, updates);
  }

  const actor = await getCurrentActor();
  const tx = await repo.verifyOrder(id, actor, { companies, yourRef, invoiceNoOverrides, termsDays });
  if (!tx) return NextResponse.json({ error: "could not generate" }, { status: 500 });
  return NextResponse.json({ transactionId: tx.id });
}

// DELETE = reject the order.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await repo.rejectOrder(id, await getCurrentActor());
  return NextResponse.json({ ok: true });
}
