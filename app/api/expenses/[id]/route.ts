import { NextRequest, NextResponse } from "next/server";
import { verifyExpense, rejectExpense } from "@/lib/expenses";
import { getCurrentActor } from "@/lib/staff";

// PATCH { action: "verify", vendorName?, description?, category?, amount?, date? }
// PATCH { action: "reject" }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const actor = await getCurrentActor();

  if (body.action === "reject") {
    await rejectExpense(id, actor);
    return NextResponse.json({ ok: true });
  }

  const patch: { vendorName?: string; description?: string; category?: string; amount?: number; date?: string } = {};
  if (typeof body.vendorName === "string") patch.vendorName = body.vendorName.trim();
  if (typeof body.description === "string") patch.description = body.description.trim();
  if (typeof body.category === "string") patch.category = body.category;
  if (typeof body.amount === "number") patch.amount = body.amount;
  if (typeof body.date === "string") patch.date = body.date;

  const expense = await verifyExpense(id, patch, actor);
  if (!expense) return NextResponse.json({ error: "expense not found" }, { status: 404 });
  return NextResponse.json({ ok: true, expense });
}
