import { NextRequest, NextResponse } from "next/server";
import { listExpenses, addExpense } from "@/lib/expenses";
import { EXPENSE_CATEGORIES } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ expenses: await listExpenses() });
}

// POST -> manual expense entry (Telegram-sourced ones are created server-side).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const vendorName = typeof body.vendorName === "string" ? body.vendorName.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const amount = Number(body.amount);
  if (!vendorName || !description || !(amount > 0)) {
    return NextResponse.json({ error: "vendorName, description, and a positive amount are required" }, { status: 400 });
  }
  const category = EXPENSE_CATEGORIES.includes(body.category) ? body.category : "Others";
  const expense = await addExpense({
    source: "manual",
    vendorName,
    description,
    category,
    amount,
    date: typeof body.date === "string" ? body.date : "",
  });
  return NextResponse.json({ ok: true, expense });
}
