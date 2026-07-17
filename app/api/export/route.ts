import { NextRequest, NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { invoiceHtml } from "@/lib/invoiceHtml";
import { bundleHtml, renderPdf, withAutoPrint } from "@/lib/pdf";
import { fmt2 } from "@/lib/money";
import { COMPANIES, ensureCompaniesHydrated } from "@/lib/companies";
import type { CompanyKey } from "@/lib/types";

function parseDDMMYYYY(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}
function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/export?from=yyyy-MM-dd&to=yyyy-MM-dd&company=3c&customer=foo&includeVoid=1&format=csv|pdf|autocount|sql
export async function GET(req: NextRequest) {
  await ensureCompaniesHydrated();
  const q = req.nextUrl.searchParams;
  const from = q.get("from") ? new Date(q.get("from")!) : null;
  const to = q.get("to") ? new Date(`${q.get("to")!}T23:59:59`) : null;
  const company = (q.get("company") || "all") as CompanyKey | "all";
  const customer = (q.get("customer") || "").trim().toLowerCase();
  const includeVoid = q.get("includeVoid") === "1";
  const formatParam = q.get("format");
  const format = formatParam === "pdf" || formatParam === "autocount" || formatParam === "sql" ? formatParam : "csv";

  let txs = await repo.allTransactions();

  txs = txs.filter((t) => {
    if (!includeVoid && t.status === "void") return false;
    if (customer && !t.customerName.toLowerCase().includes(customer)) return false;
    const d = parseDDMMYYYY(t.date);
    if (from && d && d < from) return false;
    if (to && d && d > to) return false;
    return true;
  });

  // flatten to one row per invoice (respecting the company filter)
  const rows = txs.flatMap((t) =>
    t.invoices
      .filter((inv) => company === "all" || inv.company === company)
      .map((inv) => ({ tx: t, inv })),
  );

  if (format === "pdf") {
    if (rows.length === 0) {
      return new NextResponse("No invoices match the selected filters.", {
        headers: { "content-type": "text/plain" },
      });
    }
    const docs = rows.map(({ tx, inv }) => invoiceHtml(inv, { voided: tx.status === "void" }));
    const html = bundleHtml(docs);
    const pdf = await renderPdf(html);
    if (pdf) {
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="invoices-export.pdf"`,
        },
      });
    }
    return new NextResponse(withAutoPrint(html), { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // AutoCount / SQL Account — one row per invoice LINE (not per invoice), the
  // shape their sales-document batch import wizards expect. Column names
  // follow each product's common import template; verify against your actual
  // AutoCount/SQL Account version before a live import, since field names can
  // vary slightly by module/version.
  if (format === "autocount" || format === "sql") {
    const debtorCode = (name: string) => name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 20) || "CASH";

    const header =
      format === "autocount"
        ? ["Doc No", "Doc Date", "Doc Type", "Debtor Code", "Debtor Name", "Item Code", "Item Description", "UOM", "Qty", "Unit Price", "Disc", "Amount", "Tax Code", "Tax Amount", "Remark"]
        : ["Invoice No", "Invoice Date", "Customer Code", "Customer Name", "Stock Code", "Stock Description", "UOM", "Quantity", "Unit Price", "Discount", "Net Amount", "Tax Code", "Tax Amount", "Remark"];

    const lines = [header.map(csvCell).join(",")];
    for (const { tx, inv } of rows) {
      const remark = tx.status === "void" ? "VOID" : "";
      for (const l of inv.lines) {
        const cells =
          format === "autocount"
            ? [
                inv.invoiceNo, tx.date, "Sales Invoice", debtorCode(inv.toName), inv.toName,
                `ITEM-${l.item}`, l.description, l.uom, l.qty, fmt2(l.unitPrice), fmt2(l.disc), fmt2(l.total),
                "", "0.00", remark,
              ]
            : [
                inv.invoiceNo, tx.date, debtorCode(inv.toName), inv.toName,
                `ITEM-${l.item}`, l.description, l.uom, l.qty, fmt2(l.unitPrice), fmt2(l.disc), fmt2(l.total),
                "", "0.00", remark,
              ];
        lines.push(cells.map(csvCell).join(","));
      }
    }
    const csv = lines.join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="invoices-${format}-export.csv"`,
      },
    });
  }

  // CSV
  const header = [
    "Date", "Transaction", "Company", "Invoice No", "Bill To",
    "Subtotal", "Rounding", "Final Total", "Status",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const { tx, inv } of rows) {
    lines.push(
      [
        tx.date,
        tx.id,
        COMPANIES[inv.company].name,
        inv.invoiceNo,
        inv.toName,
        fmt2(inv.subtotal),
        fmt2(inv.roundingAdj),
        fmt2(inv.finalTotal),
        tx.status === "void" ? "VOID" : "active",
      ].map(csvCell).join(","),
    );
  }
  const csv = lines.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="invoices-export.csv"`,
    },
  });
}
