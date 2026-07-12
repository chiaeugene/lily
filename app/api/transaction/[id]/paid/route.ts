import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";

// POST { paid: boolean } -> mark a transaction paid or unpaid.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tx = await repo.getTransaction(id);
  if (!tx) return NextResponse.json({ error: "transaction not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const paid = body.paid !== false; // default true — this endpoint is "mark paid"
  await repo.markTransactionPaid(id, paid);
  return NextResponse.json({ ok: true });
}
