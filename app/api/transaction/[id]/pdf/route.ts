import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { invoiceHtml } from "@/lib/invoiceHtml";
import { bundleHtml } from "@/lib/pdf";
import { ensureCompaniesHydrated } from "@/lib/companies";

// Bundle all three cascade invoices into one print job (Prim, 3C, Tien Ngai).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureCompaniesHydrated();
  const { id } = await params;
  const tx = await repo.getTransaction(id);
  if (!tx) return NextResponse.json({ error: "transaction not found" }, { status: 404 });
  const docs = tx.invoices.map((inv) => invoiceHtml(inv, { voided: tx.status === "void" }));
  return new NextResponse(bundleHtml(docs), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
