import { NextRequest, NextResponse } from "next/server";
import { markPayslipPaid, updatePayslip } from "@/lib/payroll";

// PATCH { paid?: boolean } and/or { allowances?, deductions?, pcb? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if ("paid" in body) {
    await markPayslipPaid(id, body.paid !== false);
  }

  const editPatch: { allowances?: number; deductions?: number; pcb?: number } = {};
  if (typeof body.allowances === "number") editPatch.allowances = Math.max(0, body.allowances);
  if (typeof body.deductions === "number") editPatch.deductions = Math.max(0, body.deductions);
  if (typeof body.pcb === "number") editPatch.pcb = Math.max(0, body.pcb);

  if (Object.keys(editPatch).length > 0) {
    const updated = await updatePayslip(id, editPatch);
    if (!updated) return NextResponse.json({ error: "payslip not found" }, { status: 404 });
    return NextResponse.json({ ok: true, payslip: updated });
  }

  return NextResponse.json({ ok: true });
}
