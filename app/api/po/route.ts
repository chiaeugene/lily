import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { getCurrentActor } from "@/lib/staff";
import { todayDDMMYYYY } from "@/lib/store";
import type { PurchaseOrder, PoLine } from "@/lib/types";

// POST = create a new purchase order from the builder form.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "no line items" }, { status: 400 });
  }

  const lines: PoLine[] = body.lines
    .filter((l: { description?: string; qty?: number }) => l?.description && Number(l.qty) > 0)
    .map((l: Partial<PoLine>) => ({
      description: String(l.description),
      uom: l.uom || "UNIT",
      qty: Number(l.qty),
      unitPrice: Number(l.unitPrice) || 0,
      disc: l.disc ? Number(l.disc) : undefined,
    }));

  if (!lines.length) return NextResponse.json({ error: "no valid line items" }, { status: 400 });
  if (!String(body.supplierName || "").trim()) {
    return NextResponse.json({ error: "supplier name required" }, { status: 400 });
  }

  const id = await repo.nextPoNo();
  const po: PurchaseOrder = {
    id,
    quotationId: body.quotationId || undefined,
    supplierName: String(body.supplierName).trim(),
    supplierAddressLines: Array.isArray(body.supplierAddressLines) ? body.supplierAddressLines : [],
    supplierTel: body.supplierTel || undefined,
    supplierFax: body.supplierFax || undefined,
    yourRef: body.yourRef || undefined,
    terms: body.terms || "C.O.D.",
    date: /^\d{2}\/\d{2}\/\d{4}$/.test(body.date || "") ? body.date : todayDDMMYYYY(),
    deliveryDate: /^\d{2}\/\d{2}\/\d{4}$/.test(body.deliveryDate || "") ? body.deliveryDate : undefined,
    lines,
    status: "draft",
    createdAt: new Date().toISOString(),
  };

  await repo.addPurchaseOrder(po, await getCurrentActor());
  return NextResponse.json({ id });
}
