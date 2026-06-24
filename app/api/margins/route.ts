import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import type { MarginRule } from "@/lib/types";

// POST a single margin rule { productId, tier, type, value } to upsert.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as MarginRule | null;
  if (!body || !body.productId || !body.tier) {
    return NextResponse.json({ error: "invalid rule" }, { status: 400 });
  }
  repo.upsertMarginRule({
    productId: body.productId,
    tier: body.tier,
    type: body.type === "percent" ? "percent" : "rm_per_unit",
    value: Number(body.value) || 0,
  });
  return NextResponse.json({ ok: true });
}
