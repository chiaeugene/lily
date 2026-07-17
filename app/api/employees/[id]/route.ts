import { NextRequest, NextResponse } from "next/server";
import { setEmployeeActive } from "@/lib/payroll";

// PATCH { active } -> activate/deactivate (no hard delete, past payslips stay intact).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await setEmployeeActive(id, body.active !== false);
  return NextResponse.json({ ok: true });
}
