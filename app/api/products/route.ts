import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { getCurrentActor } from "@/lib/staff";

// POST -> create or update a product.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const saved = await repo.upsertProduct(
    {
      id: typeof body.id === "string" ? body.id : "",
      name: body.name.trim(),
      specLines: Array.isArray(body.specLines)
        ? body.specLines.map((s: string) => String(s).trim()).filter(Boolean)
        : [],
      uom: body.uom ? String(body.uom).toUpperCase() : "KGS",
    },
    await getCurrentActor(),
  );
  return NextResponse.json({ ok: true, product: saved });
}
