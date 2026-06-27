import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { invoiceHtml } from "@/lib/invoiceHtml";
import { buildQuoteInvoice } from "@/lib/quote";

// Returns the standalone, printable QUOTATION HTML (3C skin).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await repo.getQuotation(id);
  if (!quote) return NextResponse.json({ error: "quotation not found" }, { status: 404 });
  const inv = buildQuoteInvoice(quote);
  return new NextResponse(invoiceHtml(inv, { docLabel: "QUOTATION" }), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
