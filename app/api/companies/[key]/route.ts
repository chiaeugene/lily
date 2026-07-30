import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { getSession } from "@/lib/currentUser";
import { getCurrentActor } from "@/lib/staff";
import { getTenantCompanyLookup } from "@/lib/tenantCompanies";
import type { CompanyKey } from "@/lib/types";

// PATCH company details (name, reg, tin, address, tel, email, banks).
// The key is whatever entity the CURRENT tenant owns — this used to accept
// only prim/3c/tien_ngai, which meant every other tenant's "Edit company"
// button saved into a 404.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  // Same rule as /api/companies/setup: letterhead changes are owner/admin-only.
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (session.user.role === "staff") {
    return NextResponse.json({ error: "Only an owner or admin can edit company details" }, { status: 403 });
  }

  const { key } = await params;
  if (!/^[a-z0-9_-]{1,40}$/.test(key)) {
    return NextResponse.json({ error: "unknown company" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  await repo.updateCompany(key as CompanyKey, body, await getCurrentActor());
  const lookup = await getTenantCompanyLookup();
  return NextResponse.json({ ok: true, company: lookup[key] ?? null });
}
