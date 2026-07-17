import { NextRequest, NextResponse } from "next/server";
import { getPayrollRun } from "@/lib/payroll";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getPayrollRun(id);
  if (!run) return NextResponse.json({ error: "payroll run not found" }, { status: 404 });
  return NextResponse.json({ run });
}
