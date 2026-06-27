import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { todayDDMMYYYY } from "@/lib/store";
import type { Order, OrderLine } from "@/lib/types";

// POST = create a new quotation from the builder form.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "no line items" }, { status: 400 });
  }

  const lines: OrderLine[] = body.lines
    .filter((l: { productName?: string; qty?: number }) => l?.productName && Number(l.qty) > 0)
    .map((l: Partial<OrderLine>) => ({
      productId: l.productId ?? `adhoc-${String(l.productName).slice(0, 20)}`,
      productName: String(l.productName),
      specLines: Array.isArray(l.specLines) ? l.specLines : [],
      qty: Number(l.qty),
      uom: l.uom || "BOXES",
      sellUnitPrice: Number(l.sellUnitPrice) || 0,
    }));

  if (!lines.length) return NextResponse.json({ error: "no valid line items" }, { status: 400 });

  const id = await repo.nextQuoteNo();
  const order: Order = {
    id,
    source: "quotation",
    customerId: body.customerId || undefined,
    customerName: String(body.customerName || "").trim() || "UNKNOWN CUSTOMER",
    customerAddressLines: Array.isArray(body.customerAddressLines) ? body.customerAddressLines : [],
    customerTel: body.customerTel || undefined,
    terms: body.terms || "C.O.D.",
    date: /^\d{2}\/\d{2}\/\d{4}$/.test(body.date || "") ? body.date : todayDDMMYYYY(),
    lines,
    status: "quote",
    createdAt: new Date().toISOString(),
  };

  await repo.addQuotation(order);
  return NextResponse.json({ id });
}
