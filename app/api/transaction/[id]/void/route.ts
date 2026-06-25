import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";

// POST { reason } -> mark a transaction (and its 3 invoices) VOID.
// The invoice numbers are kept (no gap in the legal series); the transaction is
// excluded from sales/margin totals and the PDFs get a VOID watermark.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tx = await repo.getTransaction(id);
  if (!tx) return NextResponse.json({ error: "transaction not found" }, { status: 404 });
  if (tx.status === "void") return NextResponse.json({ ok: true, already: true });

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason : "";
  await repo.voidTransaction(id, reason);
  return NextResponse.json({ ok: true });
}
