import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { getCurrentActor } from "@/lib/staff";
import type { MarginRule } from "@/lib/types";

// POST a single margin rule { productId, layer, type, value } to upsert.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as MarginRule | null;
  if (!body || !body.productId || !body.layer) {
    return NextResponse.json({ error: "invalid rule" }, { status: 400 });
  }
  await repo.upsertMarginRule(
    {
      productId: body.productId,
      layer: Number(body.layer),
      type: body.type === "percent" ? "percent" : "rm_per_unit",
      value: Number(body.value) || 0,
    },
    await getCurrentActor(),
  );
  return NextResponse.json({ ok: true });
}
