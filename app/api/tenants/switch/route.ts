import { NextRequest, NextResponse } from "next/server";
import { getSession, TENANT_COOKIE_NAME } from "@/lib/currentUser";
import { getTenant } from "@/lib/tenant";

// POST { tenantId } -> super-admin "act as" this company.
// Enforced server-side: a non-super-admin cannot set this cookie to reach
// another company's data, and getSession() ignores it for other roles anyway.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Only the platform admin can switch companies" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
  const tenant = await getTenant(tenantId);
  if (!tenant) return NextResponse.json({ error: "company not found" }, { status: 404 });

  const res = NextResponse.json({ ok: true, tenant });
  res.cookies.set(TENANT_COOKIE_NAME, tenant.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
