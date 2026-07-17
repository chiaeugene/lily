import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { invoiceHtml } from "@/lib/invoiceHtml";
import { renderPdf, withAutoPrint } from "@/lib/pdf";
import { ensureCompaniesHydrated } from "@/lib/companies";

// Public, but scoped: only serves an invoice if it actually belongs to the
// customer that owns this portal token — a stranger can't fetch someone
// else's invoice just by guessing an invoice id.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; invoiceId: string }> },
) {
  await ensureCompaniesHydrated();
  const { token, invoiceId } = await params;
  const customer = await repo.getCustomerByPortalToken(token);
  if (!customer) return NextResponse.json({ error: "not found" }, { status: 404 });

  const found = await repo.getInvoice(invoiceId);
  if (!found || found.transaction.customerName !== customer.name) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const html = invoiceHtml(found.invoice, { voided: found.transaction.status === "void" });
  const pdfBuffer = await renderPdf(html);
  if (pdfBuffer) {
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${found.invoice.invoiceNo}.pdf"`,
      },
    });
  }
  return new NextResponse(withAutoPrint(html), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
