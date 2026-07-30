import { NextRequest, NextResponse } from "next/server";
import { addPaymentVoucher } from "@/lib/expenses";
import { getCurrentActor } from "@/lib/staff";

// POST { amount, paidDate, method, reference } -> records payment, marks the expense paid.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!(amount > 0)) return NextResponse.json({ error: "a positive amount is required" }, { status: 400 });

  const voucher = await addPaymentVoucher({
    expenseId: id,
    amount,
    paidDate: typeof body.paidDate === "string" ? body.paidDate : "",
    method: typeof body.method === "string" ? body.method : "Bank Transfer",
    reference: typeof body.reference === "string" ? body.reference : undefined,
    createdBy: await getCurrentActor(),
  });
  if (!voucher) return NextResponse.json({ error: "expense not found or not yet verified" }, { status: 400 });
  return NextResponse.json({ ok: true, voucher });
}
