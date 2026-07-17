import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { invoiceHtml } from "@/lib/invoiceHtml";
import { buildQuoteInvoice } from "@/lib/quote";
import { renderPdf, withAutoPrint } from "@/lib/pdf";
import { ensureCompaniesHydrated } from "@/lib/companies";

// Real PDF for a quotation (Chromium on Render); HTML+autoprint fallback on dev.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureCompaniesHydrated();
  const { id } = await params;
  const quote = await repo.getQuotation(id);
  if (!quote) return NextResponse.json({ error: "quotation not found" }, { status: 404 });

  const html = invoiceHtml(buildQuoteInvoice(quote), { docLabel: "QUOTATION" });
  const pdf = await renderPdf(html);
  if (pdf) {
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${id}.pdf"`,
      },
    });
  }
  return new NextResponse(withAutoPrint(html), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
