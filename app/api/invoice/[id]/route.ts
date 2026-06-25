import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { invoiceHtml } from "@/lib/invoiceHtml";

// Returns the standalone, printable invoice HTML for one company skin.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await repo.getInvoice(id);
  if (!found) return NextResponse.json({ error: "invoice not found" }, { status: 404 });
  return new NextResponse(invoiceHtml(found.invoice, { voided: found.transaction.status === "void" }), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
