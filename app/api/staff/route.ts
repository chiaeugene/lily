import { NextRequest, NextResponse } from "next/server";
import { listStaff, addStaff, findStaffByPasscode } from "@/lib/staff";

// GET -> list all staff (passcodes included — this is an internal admin-only page).
export async function GET() {
  const staff = await listStaff();
  return NextResponse.json({ staff });
}

// POST { name, passcode } -> add a new staff member with their own passcode.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const passcode = typeof body.passcode === "string" ? body.passcode.trim() : "";
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!/^\d{4,8}$/.test(passcode)) {
    return NextResponse.json({ error: "Passcode must be 4-8 digits" }, { status: 400 });
  }
  const existing = await findStaffByPasscode(passcode);
  if (existing) return NextResponse.json({ error: "That passcode is already in use" }, { status: 409 });

  const staff = await addStaff(name, passcode);
  return NextResponse.json({ ok: true, staff });
}
