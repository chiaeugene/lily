import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { isMyinvoisConfigured, submitInvoice } from "@/lib/myinvois";
import { getTenantCompanyLookup } from "@/lib/tenantCompanies";
import { ensureCompaniesHydrated } from "@/lib/companies";
import { getCurrentActor } from "@/lib/staff";

// POST -> submit this invoice to LHDN MyInvois under the issuer's own TIN.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isMyinvoisConfigured()) {
    return NextResponse.json(
      { error: "MyInvois is not configured. Set MYINVOIS_CLIENT_ID and MYINVOIS_CLIENT_SECRET." },
      { status: 400 },
    );
  }
  await ensureCompaniesHydrated();
  const { id } = await params;
  const found = await repo.getInvoice(id);
  if (!found) return NextResponse.json({ error: "invoice not found" }, { status: 404 });
  if (found.transaction.status === "void") {
    return NextResponse.json({ error: "cannot submit a void invoice" }, { status: 400 });
  }

  const lookup = await getTenantCompanyLookup();
  const company = lookup[found.invoice.company] ?? lookup.primary;

  try {
    const actor = await getCurrentActor();
    const result = await submitInvoice(found.invoice, company);
    await repo.setInvoiceMyinvois(id, { status: result.status, uid: result.uid }, actor);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "submission failed" }, { status: 502 });
  }
}
