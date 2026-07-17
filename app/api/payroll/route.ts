import { NextRequest, NextResponse } from "next/server";
import { listPayrollRuns, runPayroll } from "@/lib/payroll";
import { getCurrentActor } from "@/lib/staff";

export async function GET() {
  return NextResponse.json({ runs: await listPayrollRuns() });
}

// POST { month: "2026-07" } -> run payroll for every active employee that month.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const month = typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month) ? body.month : "";
  if (!month) return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 });

  const existing = await listPayrollRuns();
  if (existing.some((r) => r.month === month)) {
    return NextResponse.json({ error: `Payroll for ${month} already exists` }, { status: 409 });
  }

  const run = await runPayroll(month, await getCurrentActor());
  return NextResponse.json({ ok: true, run });
}
