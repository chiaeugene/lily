import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { invoiceHtml } from "@/lib/invoiceHtml";
import { withAutoPrint } from "@/lib/pdf";

// "Save PDF": returns the invoice HTML that auto-opens the browser print dialog
// (Save as PDF). Zero-dependency and works everywhere. A true server-rendered
// PDF via headless Chromium can be enabled on Render later (see lib/pdf.ts).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = repo.getInvoice(id);
  if (!found) return NextResponse.json({ error: "invoice not found" }, { status: 404 });
  return new NextResponse(withAutoPrint(invoiceHtml(found.invoice)), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
