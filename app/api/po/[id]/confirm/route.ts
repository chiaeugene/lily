import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { getCurrentActor } from "@/lib/staff";

// POST = confirm a purchase order. If it's linked to a quotation, this also
// spawns that quotation's pending sell-order (ready for the invoice cascade).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await repo.confirmPurchaseOrder(id, await getCurrentActor());
  if (!result) return NextResponse.json({ error: "purchase order not found" }, { status: 404 });
  return NextResponse.json({ orderId: result.orderId });
}
