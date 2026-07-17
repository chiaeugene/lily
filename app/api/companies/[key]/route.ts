import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { getCurrentActor } from "@/lib/staff";
import type { CompanyKey } from "@/lib/types";

// PATCH company details (name, reg, tin, address, tel, email, banks).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!["prim", "3c", "tien_ngai"].includes(key)) {
    return NextResponse.json({ error: "unknown company" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  await repo.updateCompany(key as CompanyKey, body, await getCurrentActor());
  return NextResponse.json({ ok: true, company: await repo.getCompany(key as CompanyKey) });
}
