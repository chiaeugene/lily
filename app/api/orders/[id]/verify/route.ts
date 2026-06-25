import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";

// POST = apply any edits made during verification, then build the 3-invoice cascade.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await repo.getOrder(id);
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const updates: { customerName?: string; lines?: typeof order.lines } = {};

  if (typeof body.customerName === "string" && body.customerName.trim()) {
    updates.customerName = body.customerName.trim();
  }
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

  const tx = await repo.verifyOrder(id);
  if (!tx) return NextResponse.json({ error: "could not generate" }, { status: 500 });
  return NextResponse.json({ transactionId: tx.id });
}

// DELETE = reject the order.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await repo.rejectOrder(id);
  return NextResponse.json({ ok: true });
}
