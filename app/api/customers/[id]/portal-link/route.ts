import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";

// POST -> returns (creating if needed) this customer's read-only portal token.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const token = await repo.ensureCustomerPortalToken(id);
    return NextResponse.json({ ok: true, token });
  } catch {
    return NextResponse.json({ error: "customer not found" }, { status: 404 });
  }
}
