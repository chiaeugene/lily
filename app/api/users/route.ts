import { NextRequest, NextResponse } from "next/server";
import { listUsers, createUser } from "@/lib/tenant";
import { getSession } from "@/lib/currentUser";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ users: await listUsers(session.tenant.id) });
}

// POST { email, password, name, role } -> add a user to the CURRENT tenant.
// Scoped to the caller's own tenant on the server, so a tenant owner can never
// create a user inside someone else's company by forging a request body.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (session.user.role === "staff") {
    return NextResponse.json({ error: "Only an owner or admin can add users" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // Only a super-admin can mint another super-admin.
  const role = body.role === "owner" ? "owner" : "staff";

  try {
    const user = await createUser({
      email,
      password,
      name,
      role,
      tenantId: session.tenant.id,
      mustChangePassword: true,
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    const msg = String((e as Error)?.message ?? "");
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: "Couldn't create that user" }, { status: 500 });
  }
}
