import type { Payslip, Employee, Company } from "./types";
import { fmt2 } from "./money";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Standalone A4 payslip HTML for one payroll run's employee. */
export function payslipHtml(p: Payslip, employee: Employee | undefined, employer: Company, month: string): string {
  const row = (label: string, value: number, negative = false) => `
    <div class="r"><span>${esc(label)}</span><span>${negative ? "-" : ""}${fmt2(value)}</span></div>`;

  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=710"/>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#000; font-size: 12px; margin:0; }
  .sheet { width: 182mm; margin: 0 auto; }
  .hdr { text-align:center; margin-bottom: 14px; }
  .co-name { font-weight:bold; font-size:18px; }
  .co-meta { font-size:10px; color:#444; }
  .title { text-align:center; font-weight:bold; font-size:15px; margin: 10px 0 16px; letter-spacing:.5px; }
  .meta { display:flex; justify-content:space-between; margin-bottom:14px; font-size:11px; }
  .meta .k { color:#666; }
  table.pay { width:100%; border-collapse:collapse; margin-bottom: 10px; }
  table.pay th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.4px; color:#666;
    border-bottom: 1px solid #000; padding: 4px 6px; }
  .col { vertical-align: top; padding: 8px 6px; width: 50%; }
  .r { display:flex; justify-content:space-between; padding: 3px 0; border-bottom: 1px dotted #ccc; }
  .r span:last-child { font-variant-numeric: tabular-nums; }
  .net { margin-top: 14px; display:flex; justify-content:space-between; align-items:center;
    border-top: 2px solid #000; padding-top: 8px; font-size: 15px; font-weight:bold; }
  .foot { margin-top: 30px; font-size: 9px; color:#888; line-height:1.5; }
</style></head>
<body>
  <div class="sheet">
    <div class="hdr">
      <div class="co-name">${esc(employer.name)}</div>
      <div class="co-meta">${employer.addressLines.map(esc).join(", ")}</div>
    </div>
    <div class="title">PAYSLIP — ${esc(month)}</div>
    <div class="meta">
      <div><span class="k">Employee:</span> <b>${esc(p.employeeName)}</b>${employee?.position ? ` — ${esc(employee.position)}` : ""}</div>
      <div><span class="k">IC/EPF/SOCSO:</span> ${esc(employee?.icNo ?? "-")} / ${esc(employee?.epfNo ?? "-")} / ${esc(employee?.socsoNo ?? "-")}</div>
    </div>
    <table class="pay"><tr>
      <td class="col">
        <div style="font-weight:bold;margin-bottom:6px;">Earnings</div>
        ${row("Basic salary", p.basicSalary)}
        ${row("Allowances", p.allowances)}
      </td>
      <td class="col">
        <div style="font-weight:bold;margin-bottom:6px;">Deductions</div>
        ${row("EPF (employee)", p.epfEmployee, true)}
        ${row("SOCSO (employee)", p.socsoEmployee, true)}
        ${row("EIS (employee)", p.eisEmployee, true)}
        ${row("PCB", p.pcb, true)}
        ${row("Other deductions", p.deductions, true)}
      </td>
    </tr></table>
    <div class="net"><span>Net Pay</span><span>RM ${fmt2(p.netPay)}</span></div>
    <div class="foot">
      Employer contributions (not deducted from employee): EPF RM${fmt2(p.epfEmployer)}, SOCSO RM${fmt2(p.socsoEmployer)}, EIS RM${fmt2(p.eisEmployer)}.<br/>
      This is a computer-generated payslip. EPF/SOCSO/EIS use standard flat-rate approximations — verify against official KWSP/PERKESO tables before relying on these figures.
    </div>
  </div>
</body></html>`;
}
