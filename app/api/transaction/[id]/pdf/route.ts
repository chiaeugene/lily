import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { invoiceHtml } from "@/lib/invoiceHtml";
import { bundleHtml } from "@/lib/pdf";
import { ensureCompaniesHydrated } from "@/lib/companies";
import { getTenantCompanyLookup } from "@/lib/tenantCompanies";

// Bundle a transaction's invoices into one print job (1 for a single-company
// tenant; all 3 cascade tiers for the Tien Ngai group).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureCompaniesHydrated();
  const { id } = await params;
  const tx = await repo.getTransaction(id);
  if (!tx) return NextResponse.json({ error: "transaction not found" }, { status: 404 });
  const lookup = await getTenantCompanyLookup();
  const docs = tx.invoices.map((inv) => invoiceHtml(inv, { voided: tx.status === "void", company: lookup[inv.company] }));
  return new NextResponse(bundleHtml(docs), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
