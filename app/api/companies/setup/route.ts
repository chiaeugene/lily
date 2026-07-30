import { NextRequest, NextResponse } from "next/server";
import { scopedDb } from "@/lib/scopedDb";
import { getSession } from "@/lib/currentUser";

// POST -> create/replace the current tenant's own invoicing entity.
// Without this a newly onboarded business has no company row, and its
// paperwork falls back to a synthesised entity carrying only its name.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (session.user.role === "staff") {
    return NextResponse.json({ error: "Only an owner or admin can edit company details" }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Company name is required" }, { status: 400 });

  const db = await scopedDb();
  const row = {
    key: typeof b.key === "string" && b.key ? b.key : "primary",
    name: name.toUpperCase(),
    reg_no: b.regNo ?? "",
    tin_no: b.tinNo ?? null,
    address_lines: Array.isArray(b.addressLines) ? b.addressLines : [],
    tel: b.tel ?? "",
    email: b.email ?? "",
    banks: Array.isArray(b.banks) ? b.banks : [],
    invoice_format: b.invoiceFormat === "running" ? "running" : "ym",
    invoice_prefix: b.invoicePrefix ?? "INV-",
    show_logo: false,
    show_qr: false,
    show_lhdn_link: false,
    show_rounding_row: false,
    show_authorised_signature: true,
  };
  const { error } = await db.from("companies").upsert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A single-company tenant needs an invoice counter too, or verifying an
  // order has nothing to draw its running number from.
  await db.from("invoice_counters").upsert({ company: row.key, seq: Number(b.startingSeq) || 0 });

  return NextResponse.json({ ok: true, company: row });
}
