import { NextRequest, NextResponse } from "next/server";

// Simple passcode gate for this internal tool. Override via env in production.
const PASSCODE = process.env.LILY_PASSCODE || "870333";
const TOKEN = process.env.LILY_AUTH_TOKEN || "lily-authed";
const COOKIE = "lily_auth";

// POST { code } -> verify passcode, set auth cookie.
export async function POST(req: NextRequest) {
  const { code } = await req.json().catch(() => ({ code: "" }));
  if (String(code) !== PASSCODE) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, TOKEN, {
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
