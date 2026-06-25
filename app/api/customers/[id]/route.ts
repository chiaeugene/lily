import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await repo.deleteCustomer(id);
  return NextResponse.json({ ok: true });
}
