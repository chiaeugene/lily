import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { getCurrentActor } from "@/lib/staff";
import { invoiceHtml } from "@/lib/invoiceHtml";
import { buildPoInvoice } from "@/lib/po";

// Returns the standalone, printable PURCHASE ORDER HTML (Tien Ngai skin).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const po = await repo.getPurchaseOrder(id);
  if (!po) return NextResponse.json({ error: "purchase order not found" }, { status: 404 });
  const inv = buildPoInvoice(po);
  return new NextResponse(
    invoiceHtml(inv, {
      docLabel: "PURCHASE ORDER",
      deliveryDate: po.deliveryDate,
      hideNotes: true,
      hideQr: true,
      forceSignature: true,
    }),
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

// DELETE = cancel a draft PO.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await repo.cancelPurchaseOrder(id, await getCurrentActor());
  return NextResponse.json({ ok: true });
}
