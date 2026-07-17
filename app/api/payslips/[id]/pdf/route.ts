import { NextRequest, NextResponse } from "next/server";
import { getPayrollRun, listEmployees } from "@/lib/payroll";
import { payslipHtml } from "@/lib/payslipHtml";
import { renderPdf, withAutoPrint } from "@/lib/pdf";
import { COMPANIES } from "@/lib/companies";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // payslip id, format "<runId>-<employeeId>"
  const runId = id.split("-").slice(0, 2).join("-"); // "PR-2607"
  const run = await getPayrollRun(runId);
  const payslip = run?.payslips.find((p) => p.id === id);
  if (!run || !payslip) return NextResponse.json({ error: "payslip not found" }, { status: 404 });

  const employees = await listEmployees();
  const employee = employees.find((e) => e.id === payslip.employeeId);
  const html = payslipHtml(payslip, employee, COMPANIES.tien_ngai, run.month);
  const pdfBuffer = await renderPdf(html);

  if (pdfBuffer) {
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${payslip.id}.pdf"`,
      },
    });
  }
  return new NextResponse(withAutoPrint(html), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
