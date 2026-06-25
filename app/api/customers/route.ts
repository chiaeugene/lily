import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";

// POST -> create or update a customer.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const saved = await repo.upsertCustomer({
    id: typeof body.id === "string" ? body.id : "",
    name: body.name.trim(),
    addressLines: Array.isArray(body.addressLines)
      ? body.addressLines.map((s: string) => String(s).trim()).filter(Boolean)
      : [],
    tel: body.tel ? String(body.tel) : undefined,
    fax: body.fax ? String(body.fax) : undefined,
  });
  return NextResponse.json({ ok: true, customer: saved });
}
