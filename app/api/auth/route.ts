import { NextRequest, NextResponse } from "next/server";
import { authenticate, ensureBootstrapAdmin } from "@/lib/tenant";
import { signStaffId } from "@/lib/session";

const COOKIE = "lily_auth";

// POST { email, password } -> verify, set a signed session cookie carrying the user id.
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({ email: "", password: "" }));

  // First run on a fresh database: create the platform admin from env vars.
  // No-ops once any user exists.
  const configured = await ensureBootstrapAdmin();

  const user = await authenticate(String(email ?? ""), String(password ?? ""));
  if (!user) {
    return NextResponse.json(
      {
        error: configured
          ? "Incorrect email or password"
          : "No admin account exists yet — set LILY_ADMIN_EMAIL and LILY_ADMIN_PASSWORD, then try again.",
      },
      { status: 401 },
    );
  }

  const token = await signStaffId(user.id);
  const res = NextResponse.json({
    ok: true,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  });
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
  res.cookies.set("lily_tenant", "", { path: "/", maxAge: 0 });
  return res;
}
