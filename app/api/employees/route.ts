import { NextRequest, NextResponse } from "next/server";
import { listEmployees, upsertEmployee } from "@/lib/payroll";

export async function GET() {
  return NextResponse.json({ employees: await listEmployees() });
}

// POST -> create or update an employee.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const employee = await upsertEmployee({
    id: typeof body.id === "string" && body.id ? body.id : undefined,
    name,
    icNo: body.icNo || undefined,
    position: body.position || undefined,
    bankName: body.bankName || undefined,
    bankAccount: body.bankAccount || undefined,
    epfNo: body.epfNo || undefined,
    socsoNo: body.socsoNo || undefined,
    basicSalary: Number(body.basicSalary) || 0,
    active: body.active !== false,
  });
  return NextResponse.json({ ok: true, employee });
}
