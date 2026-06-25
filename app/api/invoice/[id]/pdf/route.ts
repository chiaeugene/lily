import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { invoiceHtml } from "@/lib/invoiceHtml";
import { renderPdf, withAutoPrint } from "@/lib/pdf";

// Returns a real PDF (application/pdf) when Chromium is available (Render/Linux),
// or falls back to HTML+autoprint on Windows dev.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await repo.getInvoice(id);
  if (!found) return NextResponse.json({ error: "invoice not found" }, { status: 404 });

  const html = invoiceHtml(found.invoice);
  const pdfBuffer = await renderPdf(html);

  if (pdfBuffer) {
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${found.invoice.invoiceNo}.pdf"`,
      },
    });
  }

  // Fallback: HTML with browser print dialog (dev / no Chromium)
  return new NextResponse(withAutoPrint(html), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
