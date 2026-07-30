import { NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { addExpense, verifyExpense, addPaymentVoucher, listExpenses } from "@/lib/expenses";
import { getSession } from "@/lib/currentUser";
import type { Order } from "@/lib/types";

// Seeds realistic demo data into the CURRENT company. Super-admin only, and
// refuses if the company already has orders — so it can't quietly duplicate
// or trample real records.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Only the platform admin can seed demo data" }, { status: 403 });
  }

  // Per-section guards rather than one all-or-nothing check, so the seed is
  // idempotent and resumable: it fills in only what's missing. (The first run
  // of this was killed mid-way by a client timeout, which left orders created
  // but expenses not — an all-or-nothing guard then refused to finish the job.)
  const existingOrders = await repo.listPendingOrders();
  const existingExpenses = await listExpenses();
  const seedOrders = existingOrders.length === 0;
  const seedExpenses = existingExpenses.length === 0;
  if (!seedOrders && !seedExpenses) {
    return NextResponse.json(
      { error: "This company already has orders and expenses — nothing left to seed." },
      { status: 409 },
    );
  }

  const D = (d: number) => `${String(d).padStart(2, "0")}/07/2026`;
  const iso = (d: number) => new Date(Date.UTC(2026, 6, d, 9, 0)).toISOString();

  // ── Catalogue ────────────────────────────────────────────────────────────
  const customers = [
    { name: "SENGGARANG HARDWARE SDN BHD", addressLines: ["LOT 44, JALAN PERINDUSTRIAN 2", "81500 PEKAN NANAS JOHOR"], tel: "07 699 2231" },
    { name: "BINTANG COLD CHAIN", addressLines: ["NO 12, JALAN TIARA 3", "40400 SHAH ALAM SELANGOR"], tel: "03 5511 8080" },
    { name: "MEGAH FURNITURE TRADING", addressLines: ["PT 8891, JALAN KUANTAN", "25200 KUANTAN PAHANG"], tel: "09 517 4422" },
    { name: "SRI DAMAI MINIMART", addressLines: ["NO 3, JALAN DAMAI UTAMA", "47180 PUCHONG SELANGOR"], tel: "012 733 9014" },
  ];
  if (seedOrders) for (const c of customers) await repo.upsertCustomer({ id: "", ...c }, "Seed");

  const products = [
    { name: "FULL TRUCK LOAD — KLANG TO JOHOR BAHRU", specLines: ["1 x 40ft container"], uom: "TRIP" },
    { name: "LESS-THAN-TRUCKLOAD — KLANG VALLEY", specLines: ["per pallet, next-day"], uom: "PALLET" },
    { name: "COLD CHAIN DELIVERY — 0°C TO 4°C", specLines: ["reefer, temperature logged"], uom: "TRIP" },
    { name: "WAREHOUSE STORAGE — AMBIENT", specLines: ["per pallet per month"], uom: "PALLET" },
    { name: "LAST-MILE DELIVERY — KLANG VALLEY", specLines: ["per drop, under 50kg"], uom: "DROP" },
  ];
  const savedProducts = [];
  if (seedOrders) for (const p of products) savedProducts.push(await repo.upsertProduct({ id: "", ...p }, "Seed"));

  // ── Pending SALES orders (as if the bot parsed them from Telegram) ───────
  const salesDrafts: {
    day: number; customer: string; raw: string; conf: number; notes?: string;
    line: { pi: number; qty: number; price: number };
  }[] = [
    { day: 14, customer: "SENGGARANG HARDWARE SDN BHD", raw: "2 trips FTL klang to jb for senggarang hardware @1850 cod", conf: 0.96,
      line: { pi: 0, qty: 2, price: 1850 } },
    { day: 16, customer: "BINTANG COLD CHAIN", raw: "🎙 (voice) bintang cold chain need 3 reefer trip this week, 2200 each, 30 days", conf: 0.71,
      notes: "Transcribed from a voice note — please confirm the rate before invoicing.",
      line: { pi: 2, qty: 3, price: 2200 } },
    { day: 18, customer: "MEGAH FURNITURE TRADING", raw: "18 pallets LTL for megah furniture @145", conf: 0.93,
      line: { pi: 1, qty: 18, price: 145 } },
    { day: 19, customer: "SRI DAMAI MINIMART", raw: "sri damai 40 drops last mile 18 each cod", conf: 0.88,
      line: { pi: 4, qty: 40, price: 18 } },
  ];

  if (seedOrders) for (const d of salesDrafts) {
    const prod = savedProducts[d.line.pi];
    const cust = customers.find((c) => c.name === d.customer)!;
    const order: Order = {
      id: `ord-seed-${d.day}`,
      source: "telegram",
      rawMessage: d.raw,
      telegramUser: "demo",
      customerName: cust.name,
      customerAddressLines: cust.addressLines,
      customerTel: cust.tel,
      terms: d.line.price > 2000 ? "30 Days" : "C.O.D.",
      date: D(d.day),
      lines: [
        {
          productId: prod.id,
          productName: prod.name,
          specLines: prod.specLines,
          qty: d.line.qty,
          uom: prod.uom,
          sellUnitPrice: d.line.price,
        },
      ],
      status: "pending",
      parseConfidence: d.conf,
      parseNotes: d.notes,
      createdAt: iso(d.day),
    };
    await repo.addOrder(order);
  }

  // ── Pending EXPENSES (money-out side of the verification queue) ──────────
  const expenseDrafts = [
    { day: 15, vendor: "PETRONAS DAGANGAN", desc: "Diesel — fleet refuel, 3 lorries", cat: "Transport & Logistics", amt: 1284.6, conf: 0.94,
      raw: "diesel 1284.60 petronas nilai" },
    { day: 17, vendor: "TENAGA NASIONAL BERHAD", desc: "Electricity — warehouse, July", cat: "Utilities", amt: 942.35, conf: 0.98,
      raw: "(photo of TNB bill)" },
    { day: 18, vendor: "AUTOCARE TRUCK SERVICE", desc: "Service + brake pads — WVX 4471", cat: "Repairs & Maintenance", amt: 2180.0, conf: 0.62,
      raw: "workshop bill 2180, not sure which lorry", notes: "Vehicle not identified in the message — confirm before approving." },
    { day: 20, vendor: "SYARIKAT SEWA GUDANG", desc: "Warehouse rental — July", cat: "Rental", amt: 6500.0, conf: 0.97,
      raw: "gudang rental july 6500" },
  ];
  if (seedExpenses) for (const e of expenseDrafts) {
    await addExpense({
      source: "telegram",
      rawMessage: e.raw,
      vendorName: e.vendor,
      description: e.desc,
      category: e.cat,
      amount: e.amt,
      date: D(e.day),
      parseConfidence: e.conf,
      parseNotes: e.notes,
    });
  }

  // ── Already-settled expenses so the P&L isn't empty ──────────────────────
  const settled = [
    { day: 2, vendor: "PETRONAS DAGANGAN", desc: "Diesel — fleet refuel", cat: "Transport & Logistics", amt: 1420.8 },
    { day: 5, vendor: "PLUS MALAYSIA BERHAD", desc: "Toll charges — July week 1", cat: "Transport & Logistics", amt: 386.5 },
    { day: 8, vendor: "SYARIKAT SEWA GUDANG", desc: "Warehouse rental — June", cat: "Rental", amt: 6500.0 },
    { day: 11, vendor: "ZURICH GENERAL INSURANCE", desc: "Commercial vehicle insurance", cat: "Professional Fees", amt: 3240.0 },
    { day: 12, vendor: "OFFICE CENTRAL", desc: "Printer toner + delivery note books", cat: "Office Supplies", amt: 268.9 },
  ];
  if (seedExpenses) for (const s of settled) {
    const created = await addExpense({
      source: "manual",
      vendorName: s.vendor,
      description: s.desc,
      category: s.cat,
      amount: s.amt,
      date: D(s.day),
    });
    await verifyExpense(created.id, {}, "Seed");
    await addPaymentVoucher({
      expenseId: created.id,
      amount: s.amt,
      paidDate: D(s.day + 1),
      method: s.amt > 3000 ? "Bank Transfer" : "Online Banking",
      reference: `JUL-${String(s.day).padStart(2, "0")}`,
      createdBy: "Seed",
    });
  }

  return NextResponse.json({
    ok: true,
    tenant: session.tenant.name,
    seeded: {
      customers: seedOrders ? customers.length : 0,
      products: seedOrders ? products.length : 0,
      pendingSalesOrders: seedOrders ? salesDrafts.length : 0,
      pendingExpenses: seedExpenses ? expenseDrafts.length : 0,
      paidExpenses: seedExpenses ? settled.length : 0,
    },
  });
}
