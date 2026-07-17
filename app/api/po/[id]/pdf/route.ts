import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { invoiceHtml } from "@/lib/invoiceHtml";
import { buildPoInvoice } from "@/lib/po";
import { renderPdf, withAutoPrint } from "@/lib/pdf";
import { ensureCompaniesHydrated } from "@/lib/companies";

// Real PDF for a purchase order (Chromium on Render); HTML+autoprint fallback on dev.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureCompaniesHydrated();
  const { id } = await params;
  const po = await repo.getPurchaseOrder(id);
  if (!po) return NextResponse.json({ error: "purchase order not found" }, { status: 404 });

  const html = invoiceHtml(buildPoInvoice(po), {
    docLabel: "PURCHASE ORDER",
    deliveryDate: po.deliveryDate,
    hideNotes: true,
    hideQr: true,
    forceSignature: true,
  });
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
