import { NextRequest, NextResponse } from "next/server";
import { setStaffActive } from "@/lib/staff";

// PATCH { active } -> activate or deactivate a staff member (no hard delete,
// so past audit-log entries still resolve to a real name).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  await setStaffActive(id, body.active !== false);
  return NextResponse.json({ ok: true });
}
