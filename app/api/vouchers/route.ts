import { NextResponse } from "next/server";
import { listPaymentVouchers } from "@/lib/expenses";

export async function GET() {
  return NextResponse.json({ vouchers: await listPaymentVouchers() });
}
