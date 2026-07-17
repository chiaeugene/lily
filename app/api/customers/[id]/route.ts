import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { getCurrentActor } from "@/lib/staff";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await repo.deleteCustomer(id, await getCurrentActor());
  return NextResponse.json({ ok: true });
}
