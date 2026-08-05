import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { ensureCompaniesHydrated } from "@/lib/companies";
import { getIssuingCompany } from "@/lib/tenantCompanies";
import { fmt2 } from "@/lib/money";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function parseDDMMYYYY(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

// GET /api/soa?customer=NAME&from=yyyy-MM-dd&to=yyyy-MM-dd
// Statement of Account from the tenant's invoicing entity to one customer.
export async function GET(req: NextRequest) {
  await ensureCompaniesHydrated();
  const q = req.nextUrl.searchParams;
  const customer = (q.get("customer") || "").trim();
  if (!customer) return NextResponse.json({ error: "customer required" }, { status: 400 });
  const from = q.get("from") ? new Date(q.get("from")!) : null;
  const to = q.get("to") ? new Date(`${q.get("to")!}T23:59:59`) : null;

  const issuer = await getIssuingCompany("invoice");
  const all = await repo.allTransactions();
  const txs = all
    .filter((t) => t.status !== "void")
    .filter((t) => t.customerName.toLowerCase() === customer.toLowerCase())
    .filter((t) => {
      const d = parseDDMMYYYY(t.date);
      if (from && d && d < from) return false;
      if (to && d && d > to) return false;
      return true;
    })
    .sort((a, b) => (parseDDMMYYYY(a.date)?.getTime() ?? 0) - (parseDDMMYYYY(b.date)?.getTime() ?? 0));

  let billed = 0, paid = 0;
  const rows = txs
    .map((t) => {
      // the customer-facing invoice: billed to the customer (last one as fallback)
      const inv = t.invoices.find((i) => i.toName === t.customerName) ?? t.invoices[t.invoices.length - 1];
      const isPaid = (t.paidStatus ?? "unpaid") === "paid";
      billed += t.grandTotalSell;
      if (isPaid) paid += t.grandTotalSell;
      return `<tr>
        <td>${esc(t.date)}</td>
        <td>${esc(inv?.invoiceNo ?? t.id)}</td>
        <td class="r">${fmt2(t.grandTotalSell)}</td>
        <td class="${isPaid ? "ok" : "due"}">${isPaid ? "PAID" : "OUTSTANDING"}</td>
      </tr>`;
    })
    .join("");
  const balance = billed - paid;
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=710"/>
<title>SOA — ${esc(customer)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#000; font-size:12px; margin:0; padding:16px; }
  .sheet { width: 182mm; margin: 0 auto; }
  .co { text-align:center; }
  .co-name { font-family:"Times New Roman",Georgia,serif; font-weight:bold; font-size:19px; }
  .co-meta { font-family:"Times New Roman",Georgia,serif; font-size:10px; line-height:1.35; }
  h1 { font-size:15px; text-align:center; margin:14px 0 2px; letter-spacing:1px; }
  .sub { text-align:center; font-size:11px; color:#444; margin-bottom:14px; }
  .cust { margin:10px 0 14px; }
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid #000; padding:5px 8px; text-align:left; }
  th { background:#f0f0f0; font-size:11px; }
  .r { text-align:right; font-variant-numeric:tabular-nums; }
  .ok { color:#15803d; font-weight:bold; font-size:11px; }
  .due { color:#b91c1c; font-weight:bold; font-size:11px; }
  .totals { margin-top:12px; width:60%; margin-left:auto; }
  .totals td { border:1px solid #000; }
  .totals .k { background:#f0f0f0; width:55%; }
  .bal { font-weight:bold; }
  .foot { margin-top:18px; font-size:10px; color:#555; }
  .noprint { text-align:center; margin:14px 0; }
  .noprint button { padding:8px 22px; font-size:13px; cursor:pointer; }
  @media print { .noprint { display:none; } }
</style></head><body>
<div class="sheet">
  <div class="co">
    <div class="co-name">${esc(issuer.name)}</div>
    ${issuer.regNo ? `<div class="co-meta">Reg No : ${esc(issuer.regNo)}</div>` : ""}
    ${issuer.addressLines.map((l) => `<div class="co-meta">${esc(l)}</div>`).join("")}
    ${issuer.tel || issuer.email ? `<div class="co-meta">${issuer.tel ? `Tel: ${esc(issuer.tel)}` : ""}${issuer.tel && issuer.email ? "&nbsp;&nbsp;" : ""}${issuer.email ? `Email: ${esc(issuer.email)}` : ""}</div>` : ""}
  </div>
  <h1>STATEMENT OF ACCOUNT</h1>
  <div class="sub">As at ${todayStr}${from || to ? ` · period ${q.get("from") ?? "…"} → ${q.get("to") ?? "…"}` : ""}</div>
  <div class="cust"><b>To :</b> ${esc(customer.toUpperCase())}</div>
  <table>
    <thead><tr><th>Date</th><th>Invoice No.</th><th class="r">Amount (RM)</th><th>Status</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="4" style="text-align:center;color:#666">No invoices in this period.</td></tr>`}</tbody>
  </table>
  <table class="totals">
    <tr><td class="k">Total billed</td><td class="r">${fmt2(billed)}</td></tr>
    <tr><td class="k">Total paid</td><td class="r">${fmt2(paid)}</td></tr>
    <tr class="bal"><td class="k">Balance outstanding</td><td class="r">${fmt2(balance)}</td></tr>
  </table>
  <div class="foot">Kindly settle the outstanding balance at your earliest convenience. Please contact us if any entry does not match your records.</div>
  <div class="noprint"><button onclick="window.print()">Print / Save as PDF</button></div>
</div>
</body></html>`;

  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
