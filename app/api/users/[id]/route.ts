import { NextRequest, NextResponse } from "next/server";
import { listUsers, setUserActive, setUserPassword } from "@/lib/tenant";
import { getSession } from "@/lib/currentUser";

// PATCH { active } | { password }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const isSelf = session.user.id === id;
  const isAdmin = session.user.role !== "staff";

  // Anyone may change their own password. Only an owner/admin may touch
  // someone else's account — and only inside their own tenant.
  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const inTenant = (await listUsers(session.tenant.id)).some((u) => u.id === id);
  if (!inTenant) return NextResponse.json({ error: "user not found" }, { status: 404 });

  if (typeof body.password === "string") {
    if (body.password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    await setUserPassword(id, body.password);
    return NextResponse.json({ ok: true });
  }

  if ("active" in body) {
    if (isSelf && body.active === false) {
      return NextResponse.json({ error: "You can't deactivate your own account" }, { status: 400 });
    }
    if (!isAdmin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    await setUserActive(id, body.active !== false);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}
