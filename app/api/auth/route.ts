import { NextRequest, NextResponse } from "next/server";
import { findStaffByPasscode } from "@/lib/staff";
import { signStaffId } from "@/lib/session";

const COOKIE = "lily_auth";

// POST { code } -> look up the staff member by their personal passcode,
// verify, set a signed auth cookie carrying who they are.
export async function POST(req: NextRequest) {
  const { code } = await req.json().catch(() => ({ code: "" }));
  const staff = await findStaffByPasscode(String(code ?? ""));
  if (!staff) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }
  const token = await signStaffId(staff.id);
  const res = NextResponse.json({ ok: true, name: staff.name });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}

// DELETE -> log out.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
