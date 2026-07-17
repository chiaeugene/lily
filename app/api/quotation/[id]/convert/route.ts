import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { getCurrentActor } from "@/lib/staff";

// POST = accept a quotation → spawn a pending order (for the cascade).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = await repo.convertQuotationToOrder(id, await getCurrentActor());
  if (!orderId) return NextResponse.json({ error: "quotation not found" }, { status: 404 });
  return NextResponse.json({ orderId });
}
