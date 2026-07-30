import { NextRequest, NextResponse } from "next/server";
import { listTenants, createTenant, createUser } from "@/lib/tenant";
import { getSession } from "@/lib/currentUser";

/** Only the platform owner may see or create companies. */
async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) };
  if (session.user.role !== "super_admin") {
    return { error: NextResponse.json({ error: "Only the platform admin can manage companies" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  return NextResponse.json({ tenants: await listTenants() });
}

// POST { name, slug, ownerName, ownerEmail, ownerPassword }
// Creates a company AND its first owner account in one step.
export async function POST(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = (typeof body.slug === "string" ? body.slug : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const ownerEmail = typeof body.ownerEmail === "string" ? body.ownerEmail.trim().toLowerCase() : "";
  const ownerName = typeof body.ownerName === "string" ? body.ownerName.trim() : "";
  const ownerPassword = typeof body.ownerPassword === "string" ? body.ownerPassword : "";

  if (!name || !slug) return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
    return NextResponse.json({ error: "A valid owner email is required" }, { status: 400 });
  }
  if (!ownerName) return NextResponse.json({ error: "Owner name is required" }, { status: 400 });
  if (ownerPassword.length < 6) {
    return NextResponse.json({ error: "Owner password must be at least 6 characters" }, { status: 400 });
  }

  const existing = await listTenants();
  if (existing.some((t) => t.id === slug)) {
    return NextResponse.json({ error: `A company with the id "${slug}" already exists` }, { status: 409 });
  }

  try {
    const tenant = await createTenant({ name, slug });
    const owner = await createUser({
      email: ownerEmail,
      password: ownerPassword,
      name: ownerName,
      role: "owner",
      tenantId: tenant.id,
      mustChangePassword: true,
    });
    return NextResponse.json({ ok: true, tenant, owner });
  } catch (e) {
    const msg = String((e as Error)?.message ?? "");
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return NextResponse.json({ error: "That email or company id is already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "Couldn't create that company" }, { status: 500 });
  }
}
