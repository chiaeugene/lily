import { NextRequest, NextResponse } from "next/server";
import { markPayslipPaid } from "@/lib/payroll";

// PATCH { paid: boolean }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await markPayslipPaid(id, body.paid !== false);
  return NextResponse.json({ ok: true });
}
